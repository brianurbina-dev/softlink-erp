import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { compraSchema } from "@/lib/validations/compras"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

export interface CompraRow {
  id: string
  proveedor_id: string
  proveedor_rut: string
  proveedor_razon_social: string
  fecha: string
  estado: string
  neto: number
  iva: number
  total: number
  notas: string | null
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const estado = req.nextUrl.searchParams.get("estado")
  const search = req.nextUrl.searchParams.get("search")?.trim()

  const args: unknown[] = []
  const conditions: string[] = []

  if (estado) {
    args.push(estado)
    conditions.push(`c.estado = $${args.length}`)
  }
  if (search) {
    args.push(`%${search}%`)
    conditions.push(`(p.razon_social ILIKE $${args.length} OR p.rut ILIKE $${args.length})`)
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""

  const compras = await prisma.$queryRawUnsafe<CompraRow[]>(
    `SELECT c.*, p.rut AS proveedor_rut, p.razon_social AS proveedor_razon_social
     FROM "${s}".compras c
     JOIN "${s}".proveedores p ON p.id = c.proveedor_id
     WHERE 1=1 ${where}
     ORDER BY c.creado_en DESC LIMIT 200`,
    ...args
  )

  return NextResponse.json<ApiResponse>({ data: compras })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = compraSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { proveedorId, fecha, notas, items } = parsed.data
  const estado: string = body.estado === "ordenada" ? "ordenada" : "borrador"

  const [proveedor] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${s}".proveedores WHERE id = $1`,
    proveedorId
  )
  if (!proveedor) return NextResponse.json<ApiResponse>({ error: "Proveedor no encontrado" }, { status: 404 })

  let neto = 0
  const computedItems = items.map((item) => {
    const subtotal = item.precioUnitario * item.cantidad
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = calcularIva(neto)
  const total = neto + iva

  const [compra] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${s}".compras (proveedor_id, fecha, estado, neto, iva, total, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    proveedorId, fecha, estado, neto, iva, total, notas || null
  )

  for (const item of computedItems) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".compra_items (compra_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      compra.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: compra.id } }, { status: 201 })
}
