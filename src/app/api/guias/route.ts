import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { guiaSchema } from "@/lib/validations/guias"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

export interface GuiaRow {
  id: string
  folio: number | null
  fecha: string
  tipo_traslado: number
  cliente_id: string | null
  cliente_rut: string | null
  cliente_razon_social: string | null
  direccion_destino: string | null
  transportista_nombre: string | null
  patente: string | null
  neto: number
  iva: number
  total: number
  estado: string
  factura_id: string | null
  ref_factura_id: string | null
  ref_tipo: number | null
  ref_folio: number | null
  track_id: string | null
  pdf_url: string | null
  creado_en: string
  email_estado: string | null
  email_destinatario: string | null
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const guias = await prisma.$queryRawUnsafe<GuiaRow[]>(
    `SELECT g.*, c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".guias g
     LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
     ORDER BY g.creado_en DESC LIMIT 200`
  )

  return NextResponse.json<ApiResponse>({ data: guias })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = guiaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const {
    tipoTraslado, clienteId, fecha,
    direccionDestino, transportistaRut, transportistaNombre, patente,
    items, refFacturaId,
  } = parsed.data

  // Si hay referencia a factura, obtenemos tipo y folio
  let refTipo: number | null = null
  let refFolio: number | null = null

  if (refFacturaId) {
    const [facturaRef] = await prisma.$queryRawUnsafe<{ tipo: number; folio: number }[]>(
      `SELECT tipo, folio FROM "${ctx.schemaName}".facturas WHERE id = $1 AND folio IS NOT NULL`,
      refFacturaId
    )
    if (facturaRef) {
      refTipo = facturaRef.tipo
      refFolio = facturaRef.folio
    }
  }

  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * (item.descuento / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  const iva = tipoTraslado === 1 ? calcularIva(neto) : 0
  const total = neto + iva

  const [guia] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".guias
     (tipo_traslado, fecha, cliente_id, direccion_destino,
      transportista_rut, transportista_nombre, patente, neto, iva, total, estado,
      ref_factura_id, ref_tipo, ref_folio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'borrador', $11, $12, $13) RETURNING id`,
    tipoTraslado, fecha, clienteId ?? null,
    direccionDestino ?? null, transportistaRut ?? null,
    transportistaNombre ?? null, patente ?? null,
    neto, iva, total,
    refFacturaId ?? null, refTipo, refFolio
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".guia_items
       (guia_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      guia.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento,
      item.subtotal
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: guia.id } }, { status: 201 })
}
