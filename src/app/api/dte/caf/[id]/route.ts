import { NextRequest, NextResponse } from "next/server"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getCafXml } from "@/services/dte/cafService"
import type { ApiResponse } from "@/types"

/** GET /api/dte/caf/[id] — descarga el XML de un CAF como archivo */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  const { id } = await params
  const xml = await getCafXml(ctx.schemaName, id)

  if (!xml) {
    return NextResponse.json<ApiResponse>({ error: "CAF no encontrado" }, { status: 404 })
  }

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="caf_${id}.xml"`,
    },
  })
}
