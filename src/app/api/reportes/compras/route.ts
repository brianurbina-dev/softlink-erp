import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export interface ReporteComprasData {
  comprasPorMes: { mes: string; label: string; total: number; cantidad: number }[]
  topProveedores: { proveedor_id: string; razon_social: string; total: number; cantidad: number }[]
  totalPeriodo: number
  cantidadOrdenes: number
  totalVentasPeriodo: number
  margenBruto: number
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const hoy = new Date()

  const desdeParam = req.nextUrl.searchParams.get("desde")
  const hastaParam = req.nextUrl.searchParams.get("hasta")
  const hasta  = hastaParam ? new Date(hastaParam + "T23:59:59") : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const desde  = desdeParam ? new Date(desdeParam + "T00:00:00") : new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
  const desdeStr = desde.toISOString().split("T")[0]
  const hastaStr = hasta.toISOString().split("T")[0]

  const comprasMes = await prisma.$queryRawUnsafe<{ mes: string; total: bigint; cantidad: bigint }[]>(
    `SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
            SUM(total)::bigint        AS total,
            COUNT(*)::bigint          AS cantidad
     FROM "${s}".compras
     WHERE estado = 'recibida' AND fecha BETWEEN $1 AND $2
     GROUP BY mes ORDER BY mes`,
    desdeStr, hastaStr
  )

  const mesMap = new Map<string, { total: number; cantidad: number }>()
  for (const r of comprasMes) {
    mesMap.set(r.mes, { total: Number(r.total), cantidad: Number(r.cantidad) })
  }

  const comprasPorMes: ReporteComprasData["comprasPorMes"] = []
  const cur = new Date(desde.getFullYear(), desde.getMonth(), 1)
  while (cur <= hasta) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    const d = mesMap.get(key) ?? { total: 0, cantidad: 0 }
    comprasPorMes.push({ mes: key, label: MESES[cur.getMonth()], ...d })
    cur.setMonth(cur.getMonth() + 1)
  }

  const topProveedores = await prisma.$queryRawUnsafe<{ proveedor_id: string; razon_social: string; total: bigint; cantidad: bigint }[]>(
    `SELECT c.proveedor_id, p.razon_social,
            SUM(c.total)::bigint AS total,
            COUNT(*)::bigint     AS cantidad
     FROM "${s}".compras c
     JOIN "${s}".proveedores p ON p.id = c.proveedor_id
     WHERE c.estado = 'recibida' AND c.fecha BETWEEN $1 AND $2
     GROUP BY c.proveedor_id, p.razon_social
     ORDER BY total DESC LIMIT 10`,
    desdeStr, hastaStr
  )

  // Ventas del mismo período para comparativo de margen
  const [ventasRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COALESCE(SUM(total), 0)::bigint AS total
     FROM "${s}".facturas
     WHERE estado = 'emitida' AND fecha BETWEEN $1 AND $2`,
    desdeStr, hastaStr
  )

  const totalPeriodo = comprasPorMes.reduce((s, m) => s + m.total, 0)
  const cantidadOrdenes = comprasPorMes.reduce((s, m) => s + m.cantidad, 0)
  const totalVentasPeriodo = Number(ventasRow?.total ?? 0)

  return NextResponse.json<ApiResponse<ReporteComprasData>>({
    data: {
      comprasPorMes,
      topProveedores: topProveedores.map((r) => ({ ...r, total: Number(r.total), cantidad: Number(r.cantidad) })),
      totalPeriodo,
      cantidadOrdenes,
      totalVentasPeriodo,
      margenBruto: totalVentasPeriodo - totalPeriodo,
    },
  })
}
