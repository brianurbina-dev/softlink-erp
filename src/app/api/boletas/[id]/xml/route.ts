import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { buildR2Key, downloadFromR2 } from "@/services/storage/r2Service"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return new NextResponse("No autenticado", { status: 401 })

  const [boleta] = await prisma.$queryRawUnsafe<{ folio: number | null; fecha: string }[]>(
    `SELECT folio, fecha FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )

  if (!boleta) return new NextResponse("Boleta no encontrada", { status: 404 })
  if (!boleta.folio) return new NextResponse("Boleta sin folio — no tiene XML almacenado", { status: 404 })

  const empresa = await prisma.empresa.findUnique({ where: { id: ctx.empresaId } })
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  const xmlKey = buildR2Key(empresa.rut, 39, boleta.folio, new Date(boleta.fecha), "xml")
  const content = await downloadFromR2(xmlKey)

  if (!content) {
    return new NextResponse("XML no disponible — puede que R2 no esté configurado o el archivo no exista", { status: 404 })
  }

  const download = req.nextUrl.searchParams.get("download") === "1"
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Disposition": download
        ? `attachment; filename="DTE_39_${boleta.folio}.xml"`
        : "inline",
    },
  })
}
