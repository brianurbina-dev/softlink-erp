import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio, confirmarFolio } from "@/services/dte/cafService"
import { crearAsientoAutomatico } from "@/services/contabilidad/asientosService"
import type { ApiResponse } from "@/types"
import type { DatosNota } from "@/services/dte/DTEService"

interface NotaRow {
  id: string
  tipo: number
  fecha: string
  estado: string
  referencia_tipo: number
  referencia_folio: number
  referencia_razon: string
  cliente_rut: string
  cliente_razon_social: string
  cliente_giro: string | null
  cliente_direccion: string | null
  cliente_ciudad: string | null
}

interface ItemRow {
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [nota] = await prisma.$queryRawUnsafe<NotaRow[]>(
    `SELECT f.id, f.tipo, f.fecha, f.estado,
            f.referencia_tipo, f.referencia_folio, f.referencia_razon,
            c.rut          AS cliente_rut,
            c.razon_social AS cliente_razon_social,
            c.giro         AS cliente_giro,
            c.direccion    AS cliente_direccion,
            c.ciudad       AS cliente_ciudad
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1 AND f.tipo IN (56, 61)`,
    params.id
  )

  if (!nota) return NextResponse.json<ApiResponse>({ error: "Nota no encontrada" }, { status: 404 })
  if (nota.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden emitir borradores" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, nota.tipo, ctx.empresaId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener folio DTE"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 400 })
  }

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>(
      { error: "Configura el API key y certificado DTE antes de emitir" },
      { status: 400 }
    )
  }

  const datos: DatosNota = {
    tipo: nota.tipo as 56 | 61,
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    clienteRut: nota.cliente_rut,
    clienteRazonSocial: nota.cliente_razon_social,
    clienteGiro: nota.cliente_giro ?? "Actividades del giro",
    clienteDireccion: nota.cliente_direccion ?? "Sin dirección",
    clienteComuna: nota.cliente_ciudad ?? undefined,
    referenciaTipo: nota.referencia_tipo,
    referenciaFolio: nota.referencia_folio,
    referenciaRazon: nota.referencia_razon,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: nota.referencia_tipo === 33,
    })),
    fechaEmision: new Date(nota.fecha),
  }

  const result = await dte.emitirNota(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, pdfUrl } = result.data

  await confirmarFolio(ctx.schemaName, nota.tipo)

  const [notaActualizada] = await prisma.$queryRawUnsafe<{ neto: number; iva: number; total: number }[]>(
    `UPDATE "${ctx.schemaName}".facturas
     SET folio = $1, track_id = $2, pdf_url = $3, estado = 'emitida'
     WHERE id = $4
     RETURNING neto, iva, total`,
    folio, trackId, pdfUrl ?? null, params.id
  )

  const eventoContable = nota.tipo === 61 ? "nota_credito_emitida" : "nota_debito_emitida"
  const descripcionNota = nota.tipo === 61 ? `Nota de Crédito N° ${folio}` : `Nota de Débito N° ${folio}`

  await crearAsientoAutomatico(
    ctx.schemaName,
    eventoContable,
    { neto: notaActualizada.neto, iva: notaActualizada.iva, total: notaActualizada.total },
    descripcionNota,
    "factura",
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
