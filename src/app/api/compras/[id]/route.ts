import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { compraSchema } from "@/lib/validations/compras"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

interface ItemCompraRow {
  id: string
  compra_id: string
  producto_id: string | null
  producto_codigo: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName

  const [compra] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT c.*, p.rut AS proveedor_rut, p.razon_social AS proveedor_razon_social
     FROM "${s}".compras c
     JOIN "${s}".proveedores p ON p.id = c.proveedor_id
     WHERE c.id = $1`,
    params.id
  )
  if (!compra) return NextResponse.json<ApiResponse>({ error: "Compra no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<ItemCompraRow[]>(
    `SELECT ci.*, p.codigo AS producto_codigo
     FROM "${s}".compra_items ci
     LEFT JOIN "${s}".productos p ON p.id = ci.producto_id
     WHERE ci.compra_id = $1
     ORDER BY ci.id`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...compra, items } })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName

  const [existing] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${s}".compras WHERE id = $1`,
    params.id
  )
  if (!existing) return NextResponse.json<ApiResponse>({ error: "Compra no encontrada" }, { status: 404 })
  if (existing.estado === "recibida") {
    return NextResponse.json<ApiResponse>({ error: "No se puede editar una compra ya recibida" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = compraSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { proveedorId, fecha, notas, items } = parsed.data
  const estado: string = body.estado === "ordenada" ? "ordenada" : "borrador"

  let neto = 0
  const computedItems = items.map((item) => {
    const subtotal = item.precioUnitario * item.cantidad
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = calcularIva(neto)
  const total = neto + iva

  await prisma.$executeRawUnsafe(
    `UPDATE "${s}".compras
     SET proveedor_id = $1, fecha = $2, estado = $3, neto = $4, iva = $5, total = $6, notas = $7
     WHERE id = $8`,
    proveedorId, fecha, estado, neto, iva, total, notas || null, params.id
  )

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${s}".compra_items WHERE compra_id = $1`,
    params.id
  )

  for (const item of computedItems) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".compra_items (compra_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      params.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const { estado } = await req.json() as { estado: string }

  if (!["borrador", "ordenada"].includes(estado)) {
    return NextResponse.json<ApiResponse>({ error: "Estado inválido" }, { status: 400 })
  }

  const [compra] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${s}".compras WHERE id = $1`,
    params.id
  )
  if (!compra) return NextResponse.json<ApiResponse>({ error: "Compra no encontrada" }, { status: 404 })
  if (compra.estado === "recibida") {
    return NextResponse.json<ApiResponse>({ error: "No se puede cambiar el estado de una compra recibida" }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "${s}".compras SET estado = $1 WHERE id = $2`,
    estado, params.id
  )

  return NextResponse.json<ApiResponse>({ data: { id: params.id, estado } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName

  const [deleted] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `DELETE FROM "${s}".compras WHERE id = $1 AND estado != 'recibida' RETURNING id`,
    params.id
  )

  if (!deleted) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar (no existe o ya fue recibida)" },
      { status: 400 }
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}
