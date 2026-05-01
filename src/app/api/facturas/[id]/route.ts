import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { facturaSchema } from "@/lib/validations/facturas"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

interface ItemRow {
  id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  producto_id: string | null
  producto_codigo: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [factura] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT f.*,
            c.rut AS cliente_rut, c.razon_social AS cliente_razon_social,
            c.giro AS cliente_giro, c.direccion AS cliente_direccion, c.email AS cliente_email
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1`,
    params.id
  )

  if (!factura) return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT fi.*, p.codigo AS producto_codigo
     FROM "${ctx.schemaName}".factura_items fi
     LEFT JOIN "${ctx.schemaName}".productos p ON p.id = fi.producto_id
     WHERE fi.factura_id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...factura, items } })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [existing] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${ctx.schemaName}".facturas WHERE id = $1`,
    params.id
  )
  if (!existing) return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })
  if (existing.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden editar borradores" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = facturaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipo, clienteId, fecha, items } = parsed.data

  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * (item.descuento / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = tipo === 33 ? calcularIva(neto) : 0
  const total = neto + iva

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".facturas
     SET tipo = $1, fecha = $2, cliente_id = $3, neto = $4, iva = $5, total = $6
     WHERE id = $7`,
    tipo, fecha, clienteId, neto, iva, total, params.id
  )

  await prisma.$queryRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".factura_items
       (factura_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [deleted] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `DELETE FROM "${ctx.schemaName}".facturas WHERE id = $1 AND estado = 'borrador' RETURNING id`,
    params.id
  )

  if (!deleted) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar (no existe o ya fue emitida)" },
      { status: 400 }
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}
