import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { facturaSchema } from "@/lib/validations/facturas"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

export interface FacturaRow {
  id: string
  tipo: number
  folio: number | null
  fecha: string
  cliente_id: string
  cliente_rut: string
  cliente_razon_social: string
  neto: number
  iva: number
  total: number
  estado: string
  track_id: string | null
  pdf_url: string | null
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const estado = req.nextUrl.searchParams.get("estado")
  const search = req.nextUrl.searchParams.get("search")?.trim()

  const params: unknown[] = []
  let idx = 1
  let where = ""

  if (estado) {
    where += ` AND f.estado = $${idx++}`
    params.push(estado)
  }
  if (search) {
    where += ` AND (c.razon_social ILIKE $${idx} OR c.rut ILIKE $${idx} OR CAST(f.folio AS TEXT) ILIKE $${idx})`
    params.push(`%${search}%`)
    idx++
  }

  const facturas = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT f.*, c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE 1=1 ${where}
     ORDER BY f.creado_en DESC LIMIT 200`,
    ...params
  )

  return NextResponse.json<ApiResponse>({ data: facturas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = facturaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipo, clienteId, fecha, items } = parsed.data

  const [cliente] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".clientes WHERE id = $1`,
    clienteId
  )
  if (!cliente) return NextResponse.json<ApiResponse>({ error: "Cliente no encontrado" }, { status: 404 })

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

  const [factura] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".facturas (tipo, fecha, cliente_id, neto, iva, total, estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'borrador') RETURNING id`,
    tipo, fecha, clienteId, neto, iva, total
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".factura_items
       (factura_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      factura.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: factura.id } }, { status: 201 })
}
