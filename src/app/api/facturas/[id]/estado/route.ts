import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import type { ApiResponse } from "@/types"

interface FacturaRow {
  track_id: string | null
  estado: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [factura] = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT track_id, estado FROM "${ctx.schemaName}".facturas WHERE id = $1`,
    params.id
  )

  if (!factura) {
    return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })
  }

  if (!factura.track_id) {
    return NextResponse.json<ApiResponse>({ data: { estado: factura.estado, estadoSII: null, mensaje: "Factura no emitida aún" } })
  }

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>({ data: { estado: factura.estado, estadoSII: null, mensaje: "DTE no configurado" } })
  }

  const consulta = await dte.consultarEstado(factura.track_id)
  if (!consulta.ok) {
    return NextResponse.json<ApiResponse>({ data: { estado: factura.estado, estadoSII: null, mensaje: consulta.error.message } })
  }

  return NextResponse.json<ApiResponse>({
    data: {
      estado: factura.estado,
      estadoSII: consulta.data,
      trackId: factura.track_id,
    },
  })
}
