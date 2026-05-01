import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface ResultadoRow {
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  saldo: number
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde") ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const hasta = searchParams.get("hasta") ?? new Date().toISOString().slice(0, 10)

  const filas = await prisma.$queryRawUnsafe<ResultadoRow[]>(
    `SELECT
       pc.codigo, pc.nombre, pc.tipo, pc.subtipo,
       CASE
         WHEN pc.tipo = 'ingreso'
           THEN (COALESCE(SUM(al.haber), 0) - COALESCE(SUM(al.debe), 0))::int
         ELSE
           (COALESCE(SUM(al.debe), 0) - COALESCE(SUM(al.haber), 0))::int
       END AS saldo
     FROM "${ctx.schemaName}".plan_cuentas pc
     LEFT JOIN "${ctx.schemaName}".asiento_lineas al ON al.cuenta_id = pc.id
       AND al.asiento_id IN (
         SELECT id FROM "${ctx.schemaName}".asientos
         WHERE fecha BETWEEN $1 AND $2
       )
     WHERE pc.tipo IN ('ingreso', 'gasto') AND pc.activo = true AND pc.acepta_movimientos = true
     GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo, pc.subtipo
     ORDER BY pc.codigo`,
    desde,
    hasta
  )

  const totalIngresos = filas
    .filter((f) => f.tipo === "ingreso")
    .reduce((s, f) => s + f.saldo, 0)

  const totalGastos = filas
    .filter((f) => f.tipo === "gasto")
    .reduce((s, f) => s + f.saldo, 0)

  return NextResponse.json<ApiResponse>({
    data: {
      filas,
      totalIngresos,
      totalGastos,
      resultado: totalIngresos - totalGastos,
      desde,
      hasta,
    },
  })
}
