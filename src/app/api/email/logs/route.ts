import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface EmailLogRow {
  id: string
  documento_tipo: string
  documento_id: string
  tipo_dte: number
  folio: number | null
  destinatario: string
  asunto: string
  estado: string
  resend_id: string | null
  error_mensaje: string | null
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const estado = req.nextUrl.searchParams.get("estado")
  const tipo = req.nextUrl.searchParams.get("tipo")
  const search = req.nextUrl.searchParams.get("search")?.trim()

  const params: unknown[] = []
  let idx = 1
  let where = ""

  if (estado) {
    where += ` AND estado = $${idx++}`
    params.push(estado)
  }
  if (tipo) {
    where += ` AND documento_tipo = $${idx++}`
    params.push(tipo)
  }
  if (search) {
    where += ` AND (destinatario ILIKE $${idx} OR CAST(folio AS TEXT) ILIKE $${idx})`
    params.push(`%${search}%`)
    idx++
  }

  const logs = await prisma.$queryRawUnsafe<EmailLogRow[]>(
    `SELECT * FROM "${ctx.schemaName}".email_logs
     WHERE 1=1 ${where}
     ORDER BY creado_en DESC LIMIT 500`,
    ...params
  )

  // Stats para los KPI cards
  const [stats] = await prisma.$queryRawUnsafe<
    { total: number; enviados: number; fallidos: number; sin_destinatario: number; hoy: number }[]
  >(
    `SELECT
       COUNT(*)::int                                                        AS total,
       COUNT(*) FILTER (WHERE estado = 'enviado')::int                     AS enviados,
       COUNT(*) FILTER (WHERE estado = 'fallido')::int                     AS fallidos,
       COUNT(*) FILTER (WHERE estado = 'sin_destinatario')::int            AS sin_destinatario,
       COUNT(*) FILTER (WHERE estado = 'enviado'
                          AND creado_en >= CURRENT_DATE)::int              AS hoy
     FROM "${ctx.schemaName}".email_logs`
  )

  return NextResponse.json<ApiResponse>({ data: { logs, stats } })
}
