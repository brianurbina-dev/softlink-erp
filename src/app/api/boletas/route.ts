import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { boletaSchema } from "@/lib/validations/boletas"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

export interface BoletaRow {
  id: string
  folio: number | null
  fecha: string
  receptor_rut: string | null
  receptor_nombre: string | null
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
    where += ` AND estado = $${idx++}`
    params.push(estado)
  }
  if (search) {
    where += ` AND (receptor_nombre ILIKE $${idx} OR receptor_rut ILIKE $${idx} OR CAST(folio AS TEXT) ILIKE $${idx})`
    params.push(`%${search}%`)
    idx++
  }

  const boletas = await prisma.$queryRawUnsafe<BoletaRow[]>(
    `SELECT * FROM "${ctx.schemaName}".boletas WHERE 1=1 ${where} ORDER BY creado_en DESC LIMIT 200`,
    ...params
  )

  return NextResponse.json<ApiResponse>({ data: boletas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = boletaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { fecha, receptorRut, receptorNombre, items } = parsed.data

  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * (item.descuento / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = calcularIva(neto)
  const total = neto + iva

  const [boleta] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".boletas (fecha, receptor_rut, receptor_nombre, neto, iva, total, estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'borrador') RETURNING id`,
    fecha, receptorRut ?? null, receptorNombre ?? null, neto, iva, total
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".boleta_items
       (boleta_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      boleta.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: boleta.id } }, { status: 201 })
}
