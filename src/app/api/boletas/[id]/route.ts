import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  fecha: z.string().min(1),
  receptorRut: z.string().nullable().optional(),
  receptorNombre: z.string().nullable().optional(),
  items: z.array(z.object({
    productoId: z.string().nullable().optional(),
    descripcion: z.string().min(1),
    cantidad: z.number().int().positive(),
    precioUnitario: z.number().nonnegative(),
    descuento: z.number().min(0).max(100).default(0),
  })).min(1),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [boleta] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )
  if (!boleta) return NextResponse.json<ApiResponse>({ error: "Boleta no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT bi.*, p.codigo AS producto_codigo
     FROM "${ctx.schemaName}".boleta_items bi
     LEFT JOIN "${ctx.schemaName}".productos p ON p.id = bi.producto_id
     WHERE bi.boleta_id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...boleta, items } })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [existing] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )
  if (!existing) return NextResponse.json<ApiResponse>({ error: "Boleta no encontrada" }, { status: 404 })
  if (existing.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden editar borradores" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { fecha, receptorRut, receptorNombre, items } = parsed.data

  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * ((item.descuento ?? 0) / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = calcularIva(neto)
  const total = neto + iva

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".boletas
     SET fecha=$1, receptor_rut=$2, receptor_nombre=$3, neto=$4, iva=$5, total=$6
     WHERE id=$7`,
    fecha, receptorRut ?? null, receptorNombre ?? null, neto, iva, total, params.id
  )

  await prisma.$queryRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".boleta_items WHERE boleta_id = $1`,
    params.id
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".boleta_items
       (boleta_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento ?? 0,
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
    `DELETE FROM "${ctx.schemaName}".boletas WHERE id = $1 AND estado = 'borrador' RETURNING id`,
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
