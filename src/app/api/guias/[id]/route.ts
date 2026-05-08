import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  tipoTraslado: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  clienteId: z.string().nullable().optional(),
  fecha: z.string().min(1),
  direccionDestino: z.string().nullable().optional(),
  transportistaRut: z.string().nullable().optional(),
  transportistaNombre: z.string().nullable().optional(),
  patente: z.string().nullable().optional(),
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

  const [guia] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT g.*, c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".guias g
     LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
     WHERE g.id = $1`,
    params.id
  )
  if (!guia) return NextResponse.json<ApiResponse>({ error: "Guía no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT gi.*, p.codigo AS producto_codigo
     FROM "${ctx.schemaName}".guia_items gi
     LEFT JOIN "${ctx.schemaName}".productos p ON p.id = gi.producto_id
     WHERE gi.guia_id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...guia, items } })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [existing] = await prisma.$queryRawUnsafe<{ estado: string }[]>(
    `SELECT estado FROM "${ctx.schemaName}".guias WHERE id = $1`,
    params.id
  )
  if (!existing) return NextResponse.json<ApiResponse>({ error: "Guía no encontrada" }, { status: 404 })
  if (existing.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden editar borradores" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipoTraslado, clienteId, fecha, direccionDestino, transportistaRut, transportistaNombre, patente, items } = parsed.data

  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * ((item.descuento ?? 0) / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = tipoTraslado === 1 ? calcularIva(neto) : 0
  const total = neto + iva

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".guias
     SET tipo_traslado=$1, cliente_id=$2, fecha=$3, direccion_destino=$4,
         transportista_rut=$5, transportista_nombre=$6, patente=$7, neto=$8, iva=$9, total=$10
     WHERE id=$11`,
    tipoTraslado, clienteId ?? null, fecha,
    direccionDestino ?? null, transportistaRut ?? null, transportistaNombre ?? null, patente ?? null,
    neto, iva, total, params.id
  )

  await prisma.$queryRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".guia_items WHERE guia_id = $1`,
    params.id
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".guia_items
       (guia_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
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
    `DELETE FROM "${ctx.schemaName}".guias WHERE id = $1 AND estado = 'borrador' RETURNING id`,
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
