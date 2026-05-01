import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { productoSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export interface ProductoRow {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  precio: number
  costo: number
  unidad: string
  afecto_iva: boolean
  stock_minimo: number
  activo: boolean
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const search = req.nextUrl.searchParams.get("search")?.trim()

  let productos: ProductoRow[]
  if (search) {
    productos = await prisma.$queryRawUnsafe<ProductoRow[]>(
      `SELECT * FROM "${ctx.schemaName}".productos
       WHERE activo = true AND (nombre ILIKE $1 OR codigo ILIKE $1)
       ORDER BY nombre LIMIT 500`,
      `%${search}%`
    )
  } else {
    productos = await prisma.$queryRawUnsafe<ProductoRow[]>(
      `SELECT * FROM "${ctx.schemaName}".productos
       WHERE activo = true ORDER BY nombre LIMIT 500`
    )
  }

  return NextResponse.json<ApiResponse>({ data: productos })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = productoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { codigo, nombre, descripcion, precio, costo, unidad, afectoIva, stockMinimo } = parsed.data

  const [existing] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".productos WHERE codigo = $1 LIMIT 1`,
    codigo
  )
  if (existing) {
    return NextResponse.json<ApiResponse>({ error: "Ya existe un producto con ese código" }, { status: 409 })
  }

  const [producto] = await prisma.$queryRawUnsafe<ProductoRow[]>(
    `INSERT INTO "${ctx.schemaName}".productos
       (codigo, nombre, descripcion, precio, costo, unidad, afecto_iva, stock_minimo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    codigo,
    nombre,
    descripcion || null,
    precio,
    costo,
    unidad,
    afectoIva,
    stockMinimo
  )

  return NextResponse.json<ApiResponse>({ data: producto }, { status: 201 })
}
