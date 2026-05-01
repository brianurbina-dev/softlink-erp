import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { productoSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"
import type { ProductoRow } from "../route"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const parsed = productoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { codigo, nombre, descripcion, precio, costo, unidad, afectoIva, stockMinimo } = parsed.data

  const [dup] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".productos WHERE codigo = $1 AND id != $2 LIMIT 1`,
    codigo,
    id
  )
  if (dup) {
    return NextResponse.json<ApiResponse>({ error: "Ya existe un producto con ese código" }, { status: 409 })
  }

  const [producto] = await prisma.$queryRawUnsafe<ProductoRow[]>(
    `UPDATE "${ctx.schemaName}".productos
     SET codigo = $1, nombre = $2, descripcion = $3, precio = $4, costo = $5,
         unidad = $6, afecto_iva = $7, stock_minimo = $8
     WHERE id = $9 RETURNING *`,
    codigo,
    nombre,
    descripcion || null,
    precio,
    costo,
    unidad,
    afectoIva,
    stockMinimo,
    id
  )

  if (!producto) {
    return NextResponse.json<ApiResponse>({ error: "Producto no encontrado" }, { status: 404 })
  }

  return NextResponse.json<ApiResponse>({ data: producto })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params

  const [ref] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "${ctx.schemaName}".factura_items WHERE producto_id = $1`,
    id
  )
  if ((ref?.n ?? 0) > 0) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar: el producto tiene movimientos registrados" },
      { status: 409 }
    )
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".productos WHERE id = $1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { id } })
}
