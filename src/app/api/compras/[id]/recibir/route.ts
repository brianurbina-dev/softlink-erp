import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { recibirCompraSchema } from "@/lib/validations/compras"
import { crearAsientoAutomatico } from "@/services/contabilidad/asientosService"
import type { ApiResponse } from "@/types"

interface ItemRow {
  producto_id: string | null
  cantidad: number
  precio_unitario: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = recibirCompraSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { bodegaId } = parsed.data

  const [compra] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${s}".compras WHERE id = $1`,
    params.id
  )
  if (!compra) return NextResponse.json<ApiResponse>({ error: "Compra no encontrada" }, { status: 404 })
  if (compra.estado === "recibida") {
    return NextResponse.json<ApiResponse>({ error: "Esta compra ya fue recibida" }, { status: 400 })
  }

  const [bodega] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${s}".bodegas WHERE id = $1 AND activa = true`,
    bodegaId
  )
  if (!bodega) {
    return NextResponse.json<ApiResponse>({ error: "Bodega no encontrada o inactiva" }, { status: 404 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT producto_id, cantidad, precio_unitario
     FROM "${s}".compra_items
     WHERE compra_id = $1 AND producto_id IS NOT NULL`,
    params.id
  )

  for (const item of items) {
    if (!item.producto_id) continue

    // Upsert inventario con costo promedio ponderado
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".inventario (producto_id, bodega_id, stock_actual, costo_promedio, actualizado_en)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (producto_id, bodega_id)
       DO UPDATE SET
         stock_actual   = "${s}".inventario.stock_actual + $3,
         costo_promedio = CASE WHEN $4 > 0
                            THEN (("${s}".inventario.costo_promedio * "${s}".inventario.stock_actual) + ($4 * $3))
                                 / ("${s}".inventario.stock_actual + $3)
                            ELSE "${s}".inventario.costo_promedio END,
         actualizado_en = NOW()`,
      item.producto_id,
      bodegaId,
      item.cantidad,
      item.precio_unitario
    )

    // Registrar movimiento
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".movimientos_inv
       (tipo, producto_id, bodega_id, cantidad, costo_unitario, referencia_tipo, referencia_id)
       VALUES ('entrada', $1, $2, $3, $4, 'compra', $5)`,
      item.producto_id,
      bodegaId,
      item.cantidad,
      item.precio_unitario,
      params.id
    )
  }

  const [compraFinal] = await prisma.$queryRawUnsafe<{ neto: number; iva: number; total: number; proveedor_id: string }[]>(
    `UPDATE "${s}".compras SET estado = 'recibida' WHERE id = $1
     RETURNING neto, iva, total, proveedor_id`,
    params.id
  )

  await crearAsientoAutomatico(
    s,
    "compra_recibida",
    { neto: compraFinal.neto, iva: compraFinal.iva, total: compraFinal.total },
    `Recepción de compra`,
    "compra",
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { id: params.id, itemsIngresados: items.length } })
}
