import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio, confirmarFolio } from "@/services/dte/cafService"
import { crearAsientoAutomatico } from "@/services/contabilidad/asientosService"
import type { ApiResponse } from "@/types"
import type { DatosFactura } from "@/services/dte/DTEService"

interface FacturaRow {
  id: string
  tipo: number
  fecha: string
  estado: string
  cliente_rut: string
  cliente_razon_social: string
  cliente_giro: string | null
  cliente_direccion: string | null
  cliente_ciudad: string | null
  cliente_email: string | null
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

  const [factura] = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT f.id, f.tipo, f.fecha, f.estado,
            c.rut         AS cliente_rut,
            c.razon_social AS cliente_razon_social,
            c.giro         AS cliente_giro,
            c.direccion    AS cliente_direccion,
            c.ciudad       AS cliente_ciudad,
            c.email        AS cliente_email
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1`,
    params.id
  )

  if (!factura) {
    return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })
  }
  if (factura.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden emitir borradores" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  if (items.length === 0) {
    return NextResponse.json<ApiResponse>({ error: "La factura no tiene ítems" }, { status: 400 })
  }

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, factura.tipo, ctx.empresaId)
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

  const datos: DatosFactura = {
    tipo: factura.tipo as 33 | 34,
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    clienteRut: factura.cliente_rut,
    clienteRazonSocial: factura.cliente_razon_social,
    clienteGiro: factura.cliente_giro ?? "Actividades del giro",
    clienteDireccion: factura.cliente_direccion ?? "Sin dirección",
    clienteComuna: factura.cliente_ciudad ?? undefined,
    clienteContacto: factura.cliente_email ?? undefined,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: factura.tipo === 33,
    })),
    fechaEmision: new Date(factura.fecha),
  }

  const result = await dte.emitirFactura(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, pdfUrl } = result.data

  await confirmarFolio(ctx.schemaName, factura.tipo)

  const [facturaActualizada] = await prisma.$queryRawUnsafe<{ neto: number; iva: number; total: number }[]>(
    `UPDATE "${ctx.schemaName}".facturas
     SET folio = $1, track_id = $2, pdf_url = $3, estado = 'emitida'
     WHERE id = $4
     RETURNING neto, iva, total`,
    folio, trackId, pdfUrl ?? null, params.id
  )

  await crearAsientoAutomatico(
    ctx.schemaName,
    "factura_emitida",
    { neto: facturaActualizada.neto, iva: facturaActualizada.iva, total: facturaActualizada.total },
    `Factura N° ${folio}`,
    "factura",
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
