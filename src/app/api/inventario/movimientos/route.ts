import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { movimientoSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export interface MovimientoRow {
  id: string
  tipo: string
  producto_id: string
  producto_codigo: string
  producto_nombre: string
  bodega_id: string
  bodega_nombre: string
  cantidad: number
  costo_unitario: number
  referencia_tipo: string | null
  referencia_id: string | null
  notas: string | null
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const productoId = req.nextUrl.searchParams.get("producto")?.trim()
  const bodegaId = req.nextUrl.searchParams.get("bodega")?.trim()
  const tipo = req.nextUrl.searchParams.get("tipo")?.trim()

  const conditions: string[] = []
  const args: unknown[] = []

  if (productoId) {
    args.push(productoId)
    conditions.push(`m.producto_id = $${args.length}`)
  }
  if (bodegaId) {
    args.push(bodegaId)
    conditions.push(`m.bodega_id = $${args.length}`)
  }
  if (tipo) {
    args.push(tipo)
    conditions.push(`m.tipo = $${args.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const rows = await prisma.$queryRawUnsafe<MovimientoRow[]>(
    `SELECT
       m.id, m.tipo, m.producto_id, m.bodega_id,
       m.cantidad, m.costo_unitario, m.referencia_tipo, m.referencia_id, m.notas, m.creado_en,
       p.codigo AS producto_codigo,
       p.nombre AS producto_nombre,
       b.nombre AS bodega_nombre
     FROM "${s}".movimientos_inv m
     JOIN "${s}".productos p ON p.id = m.producto_id
     JOIN "${s}".bodegas   b ON b.id = m.bodega_id
     ${where}
     ORDER BY m.creado_en DESC
     LIMIT 500`,
    ...args
  )

  return NextResponse.json<ApiResponse>({ data: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = movimientoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipo, productoId, bodegaId, cantidad, costoUnitario, notas } = parsed.data

  // Para ajuste, la cantidad puede ser negativa si el stock queda en 0
  // La UI envía siempre positivo; para salida invertimos el signo en el stock
  const delta = tipo === "salida" ? -cantidad : cantidad

  // Verificar stock suficiente para salidas
  if (tipo === "salida") {
    const [inv] = await prisma.$queryRawUnsafe<{ stock_actual: number }[]>(
      `SELECT stock_actual FROM "${s}".inventario WHERE producto_id = $1 AND bodega_id = $2`,
      productoId,
      bodegaId
    )
    if (!inv || inv.stock_actual < cantidad) {
      return NextResponse.json<ApiResponse>(
        { error: `Stock insuficiente (disponible: ${inv?.stock_actual ?? 0})` },
        { status: 409 }
      )
    }
  }

  // Upsert inventario y registrar movimiento en transacción
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${s}".inventario (producto_id, bodega_id, stock_actual, costo_promedio, actualizado_en)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (producto_id, bodega_id)
     DO UPDATE SET
       stock_actual   = "${s}".inventario.stock_actual + $3,
       costo_promedio = CASE WHEN $3 > 0 AND $4 > 0
                          THEN (("${s}".inventario.costo_promedio * "${s}".inventario.stock_actual) + ($4 * $3))
                               / ("${s}".inventario.stock_actual + $3)
                          ELSE "${s}".inventario.costo_promedio END,
       actualizado_en = NOW()`,
    productoId,
    bodegaId,
    delta,
    costoUnitario
  )

  const [movimiento] = await prisma.$queryRawUnsafe<MovimientoRow[]>(
    `INSERT INTO "${s}".movimientos_inv (tipo, producto_id, bodega_id, cantidad, costo_unitario, notas)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    tipo,
    productoId,
    bodegaId,
    cantidad,
    costoUnitario,
    notas || null
  )

  return NextResponse.json<ApiResponse>({ data: movimiento }, { status: 201 })
}
