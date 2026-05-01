import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName

  const etapaRows = await prisma.$queryRawUnsafe<{
    etapa: string
    cantidad: bigint
    valor_total: bigint
  }[]>(
    `SELECT etapa, COUNT(*)::bigint AS cantidad, COALESCE(SUM(valor_estimado),0)::bigint AS valor_total
     FROM "${s}".oportunidades
     GROUP BY etapa`
  )

  const [conversionRow] = await prisma.$queryRawUnsafe<{
    ganadas: bigint
    perdidas: bigint
    total_cerradas: bigint
  }[]>(
    `SELECT
       COUNT(*) FILTER (WHERE etapa = 'ganado')::bigint  AS ganadas,
       COUNT(*) FILTER (WHERE etapa = 'perdido')::bigint AS perdidas,
       COUNT(*) FILTER (WHERE etapa IN ('ganado','perdido'))::bigint AS total_cerradas
     FROM "${s}".oportunidades`
  )

  const [promedioRow] = await prisma.$queryRawUnsafe<{ promedio: bigint }[]>(
    `SELECT COALESCE(AVG(valor_estimado),0)::bigint AS promedio
     FROM "${s}".oportunidades
     WHERE etapa NOT IN ('ganado','perdido')`
  )

  const [vencidasRow] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM "${s}".oportunidades
     WHERE etapa NOT IN ('ganado','perdido')
       AND fecha_cierre_estimada IS NOT NULL
       AND fecha_cierre_estimada < CURRENT_DATE`
  )

  const byEtapa = etapaRows.map((r) => ({
    etapa: r.etapa,
    cantidad: Number(r.cantidad),
    valorTotal: Number(r.valor_total),
  }))

  const ganadas = Number(conversionRow?.ganadas ?? 0)
  const perdidas = Number(conversionRow?.perdidas ?? 0)
  const totalCerradas = Number(conversionRow?.total_cerradas ?? 0)

  return NextResponse.json<ApiResponse>({
    data: {
      byEtapa,
      ganadas,
      perdidas,
      totalCerradas,
      tasaConversion: totalCerradas > 0 ? Math.round((ganadas / totalCerradas) * 100) : null,
      valorPromedio: Number(promedioRow?.promedio ?? 0),
      vencidas: Number(vencidasRow?.n ?? 0),
    },
  })
}
