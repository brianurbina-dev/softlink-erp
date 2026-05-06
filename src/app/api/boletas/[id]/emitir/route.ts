import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio, confirmarFolio } from "@/services/dte/cafService"
import { crearAsientoAutomatico } from "@/services/contabilidad/asientosService"
import { validarRut } from "@/lib/chile/rut"
import type { ApiResponse } from "@/types"
import type { DatosBoleta } from "@/services/dte/DTEService"

interface BoletaRow {
  id: string
  fecha: string
  estado: string
  receptor_rut: string | null
  receptor_nombre: string | null
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

  const [boleta] = await prisma.$queryRawUnsafe<BoletaRow[]>(
    `SELECT id, fecha, estado, receptor_rut, receptor_nombre
     FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )

  if (!boleta) return NextResponse.json<ApiResponse>({ error: "Boleta no encontrada" }, { status: 404 })
  if (boleta.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden emitir borradores" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".boleta_items WHERE boleta_id = $1`,
    params.id
  )

  if (items.length === 0) {
    return NextResponse.json<ApiResponse>({ error: "La boleta no tiene ítems" }, { status: 400 })
  }

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, 39, ctx.empresaId)
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

  const rutValido = boleta.receptor_rut && validarRut(boleta.receptor_rut)

  const datos: DatosBoleta = {
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: true,
    })),
    fechaEmision: new Date(boleta.fecha),
    receptorRut: rutValido ? boleta.receptor_rut! : undefined,
    receptorNombre: rutValido ? (boleta.receptor_nombre ?? undefined) : undefined,
  }

  const result = await dte.emitirBoleta(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, pdfUrl } = result.data

  await confirmarFolio(ctx.schemaName, 39)

  const [boletaActualizada] = await prisma.$queryRawUnsafe<{ neto: number; iva: number; total: number }[]>(
    `UPDATE "${ctx.schemaName}".boletas
     SET folio = $1, track_id = $2, pdf_url = $3, estado = 'emitida'
     WHERE id = $4
     RETURNING neto, iva, total`,
    folio, trackId, pdfUrl ?? null, params.id
  )

  await crearAsientoAutomatico(
    ctx.schemaName,
    "boleta_emitida",
    { neto: boletaActualizada.neto, iva: boletaActualizada.iva, total: boletaActualizada.total },
    `Boleta N° ${folio}`,
    "boleta",
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
