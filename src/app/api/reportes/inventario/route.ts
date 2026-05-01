import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface ReporteInventarioData {
  valorTotalStock: number
  totalProductos: number
  productosStockBajo: number
  valorPorBodega: { bodega_nombre: string; valor: number; productos: number }[]
  topValor: { nombre: string; codigo: string; stock_actual: number; valor: number }[]
  movimientosMes: { tipo: string; cantidad: number; movimientos: number }[]
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`

  const valorPorBodega = await prisma.$queryRawUnsafe<{ bodega_nombre: string; valor: bigint; productos: bigint }[]>(
    `SELECT b.nombre AS bodega_nombre,
            SUM(i.stock_actual * i.costo_promedio)::bigint AS valor,
            COUNT(*)::bigint AS productos
     FROM "${s}".inventario i
     JOIN "${s}".bodegas b ON b.id = i.bodega_id
     GROUP BY b.nombre ORDER BY valor DESC`
  )

  const [totalesRow] = await prisma.$queryRawUnsafe<{ valor: bigint; productos: bigint; bajo: bigint }[]>(
    `SELECT
       SUM(i.stock_actual * i.costo_promedio)::bigint AS valor,
       COUNT(*)::bigint                                AS productos,
       SUM(CASE WHEN i.stock_actual <= p.stock_minimo THEN 1 ELSE 0 END)::bigint AS bajo
     FROM "${s}".inventario i
     JOIN "${s}".productos p ON p.id = i.producto_id`
  )

  const topValor = await prisma.$queryRawUnsafe<{ nombre: string; codigo: string; stock_actual: number; valor: bigint }[]>(
    `SELECT p.nombre, p.codigo, i.stock_actual,
            (i.stock_actual * i.costo_promedio)::bigint AS valor
     FROM "${s}".inventario i
     JOIN "${s}".productos p ON p.id = i.producto_id
     WHERE i.costo_promedio > 0
     ORDER BY valor DESC LIMIT 10`
  )

  const movimientosMes = await prisma.$queryRawUnsafe<{ tipo: string; cantidad: bigint; movimientos: bigint }[]>(
    `SELECT tipo,
            SUM(cantidad)::bigint AS cantidad,
            COUNT(*)::bigint      AS movimientos
     FROM "${s}".movimientos_inv
     WHERE creado_en >= $1
     GROUP BY tipo`,
    inicioMes
  )

  return NextResponse.json<ApiResponse<ReporteInventarioData>>({
    data: {
      valorTotalStock: Number(totalesRow?.valor ?? 0),
      totalProductos: Number(totalesRow?.productos ?? 0),
      productosStockBajo: Number(totalesRow?.bajo ?? 0),
      valorPorBodega: valorPorBodega.map((r) => ({ ...r, valor: Number(r.valor), productos: Number(r.productos) })),
      topValor: topValor.map((r) => ({ ...r, valor: Number(r.valor) })),
      movimientosMes: movimientosMes.map((r) => ({ ...r, cantidad: Number(r.cantidad), movimientos: Number(r.movimientos) })),
    },
  })
}
