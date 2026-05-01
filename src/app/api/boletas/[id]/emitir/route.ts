import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
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

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>(
      { error: "Configura el API key DTE antes de emitir" },
      { status: 400 }
    )
  }

  const datos: DatosBoleta = {
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: true,
    })),
    fechaEmision: new Date(boleta.fecha),
    receptorRut: boleta.receptor_rut ?? undefined,
    receptorNombre: boleta.receptor_nombre ?? undefined,
  }

  const result = await dte.emitirBoleta(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, pdfUrl } = result.data

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".boletas
     SET folio = $1, track_id = $2, pdf_url = $3, estado = 'emitida'
     WHERE id = $4`,
    folio, trackId, pdfUrl ?? null, params.id
  )

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
