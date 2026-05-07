import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { buildR2Key, downloadFromR2 } from "@/services/storage/r2Service"

interface FacturaRow {
  tipo: number
  folio: number | null
  fecha: string
  estado: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return new NextResponse("No autenticado", { status: 401 })

  const [factura] = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT tipo, folio, fecha, estado FROM "${ctx.schemaName}".facturas WHERE id = $1`,
    params.id
  )

  if (!factura) return new NextResponse("Factura no encontrada", { status: 404 })
  if (!factura.folio) return new NextResponse("Factura sin folio — no tiene XML almacenado", { status: 404 })

  const empresa = await prisma.empresa.findUnique({ where: { id: ctx.empresaId } })
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  const xmlKey = buildR2Key(empresa.rut, factura.tipo, factura.folio, new Date(factura.fecha), "xml")
  const content = await downloadFromR2(xmlKey)

  if (!content) {
    return new NextResponse("XML no disponible — puede que R2 no esté configurado o el archivo no exista", { status: 404 })
  }

  const download = req.nextUrl.searchParams.get("download") === "1"

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Disposition": download
        ? `attachment; filename="DTE_${factura.tipo}_${factura.folio}.xml"`
        : "inline",
    },
  })
}
