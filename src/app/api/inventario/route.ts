import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface StockRow {
  id: string
  producto_id: string
  producto_codigo: string
  producto_nombre: string
  producto_unidad: string
  producto_afecto_iva: boolean
  producto_stock_minimo: number
  bodega_id: string
  bodega_nombre: string
  stock_actual: number
  costo_promedio: number
  actualizado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const search = req.nextUrl.searchParams.get("search")?.trim()
  const bodegaId = req.nextUrl.searchParams.get("bodega")?.trim()
  const soloStockBajo = req.nextUrl.searchParams.get("bajo") === "1"

  const conditions: string[] = []
  const args: unknown[] = []

  if (bodegaId) {
    args.push(bodegaId)
    conditions.push(`i.bodega_id = $${args.length}`)
  }
  if (search) {
    args.push(`%${search}%`)
    conditions.push(`(p.nombre ILIKE $${args.length} OR p.codigo ILIKE $${args.length})`)
  }
  if (soloStockBajo) {
    conditions.push(`i.stock_actual <= p.stock_minimo`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const rows = await prisma.$queryRawUnsafe<StockRow[]>(
    `SELECT
       i.id, i.producto_id, i.bodega_id, i.stock_actual, i.costo_promedio, i.actualizado_en,
       p.codigo      AS producto_codigo,
       p.nombre      AS producto_nombre,
       p.unidad      AS producto_unidad,
       p.afecto_iva  AS producto_afecto_iva,
       p.stock_minimo AS producto_stock_minimo,
       b.nombre      AS bodega_nombre
     FROM "${s}".inventario i
     JOIN "${s}".productos p ON p.id = i.producto_id
     JOIN "${s}".bodegas   b ON b.id = i.bodega_id
     ${where}
     ORDER BY p.nombre, b.nombre`,
    ...args
  )

  return NextResponse.json<ApiResponse>({ data: rows })
}
