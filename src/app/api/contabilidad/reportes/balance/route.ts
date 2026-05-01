import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface CuentaSaldo {
  id: string
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  cuenta_padre_id: string | null
  total_debe: number
  total_haber: number
  saldo: number
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde") ?? "2000-01-01"
  const hasta = searchParams.get("hasta") ?? "2099-12-31"

  const cuentas = await prisma.$queryRawUnsafe<CuentaSaldo[]>(
    `SELECT
       pc.id, pc.codigo, pc.nombre, pc.tipo, pc.subtipo, pc.cuenta_padre_id,
       COALESCE(SUM(al.debe), 0)::int  AS total_debe,
       COALESCE(SUM(al.haber), 0)::int AS total_haber,
       CASE
         WHEN pc.tipo IN ('activo', 'gasto')
           THEN (COALESCE(SUM(al.debe), 0) - COALESCE(SUM(al.haber), 0))::int
         ELSE
           (COALESCE(SUM(al.haber), 0) - COALESCE(SUM(al.debe), 0))::int
       END AS saldo
     FROM "${ctx.schemaName}".plan_cuentas pc
     LEFT JOIN "${ctx.schemaName}".asiento_lineas al ON al.cuenta_id = pc.id
       AND al.asiento_id IN (
         SELECT id FROM "${ctx.schemaName}".asientos
         WHERE fecha BETWEEN $1 AND $2
       )
     WHERE pc.activo = true
     GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo, pc.subtipo, pc.cuenta_padre_id
     ORDER BY pc.codigo`,
    desde,
    hasta
  )

  return NextResponse.json<ApiResponse>({ data: cuentas })
}
