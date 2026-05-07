import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { buildR2Key, getSignedDownloadUrl } from "@/services/storage/r2Service"

interface NotaRow {
  tipo: number
  folio: number | null
  fecha: string
  empresa_rut: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const [row] = await prisma.$queryRawUnsafe<NotaRow[]>(
    `SELECT f.tipo, f.folio, f.fecha, e.rut AS empresa_rut
     FROM "${ctx.schemaName}".facturas f
     JOIN public.empresas e ON e.id = $1
     WHERE f.id = $2 AND f.tipo IN (56, 61) AND f.folio IS NOT NULL`,
    ctx.empresaId, params.id
  )

  if (!row) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })

  const key = buildR2Key(row.empresa_rut, row.tipo, row.folio!, new Date(row.fecha), "pdf")
  const url = await getSignedDownloadUrl(key)

  if (!url) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 })

  return NextResponse.redirect(url)
}
