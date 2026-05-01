import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

interface GuiaRow {
  id: string
  folio: number
  tipo_traslado: number
  estado: string
  cliente_id: string | null
  neto: number
}

interface ItemRow {
  producto_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [guia] = await prisma.$queryRawUnsafe<GuiaRow[]>(
    `SELECT id, folio, tipo_traslado, estado, cliente_id, neto
     FROM "${ctx.schemaName}".guias WHERE id = $1`,
    params.id
  )

  if (!guia) return NextResponse.json<ApiResponse>({ error: "Guía no encontrada" }, { status: 404 })
  if (guia.estado !== "emitida") {
    return NextResponse.json<ApiResponse>(
      { error: "Solo se pueden facturar guías emitidas" },
      { status: 400 }
    )
  }
  if (!guia.cliente_id) {
    return NextResponse.json<ApiResponse>(
      { error: "La guía no tiene receptor — asigna un cliente para facturar" },
      { status: 400 }
    )
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal
     FROM "${ctx.schemaName}".guia_items WHERE guia_id = $1`,
    params.id
  )

  // Factura afecta (33) si la guía era de tipo venta, exenta (34) si traslado
  const tipoFactura = guia.tipo_traslado === 1 ? 33 : 34
  const iva = tipoFactura === 33 ? calcularIva(guia.neto) : 0
  const total = guia.neto + iva
  const hoy = new Date().toISOString().split("T")[0]

  const [factura] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".facturas
     (tipo, fecha, cliente_id, neto, iva, total, estado,
      referencia_tipo, referencia_folio, referencia_razon)
     VALUES ($1, $2, $3, $4, $5, $6, 'borrador', 52, $7, 'Facturación de guía de despacho')
     RETURNING id`,
    tipoFactura, hoy, guia.cliente_id,
    guia.neto, iva, total, guia.folio
  )

  for (const item of items) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".factura_items
       (factura_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      factura.id,
      item.producto_id,
      item.descripcion,
      item.cantidad,
      item.precio_unitario,
      item.descuento,
      item.subtotal
    )
  }

  // Mark guía as facturada
  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".guias SET estado = 'facturada', factura_id = $1 WHERE id = $2`,
    factura.id, params.id
  )

  return NextResponse.json<ApiResponse>({
    data: { facturaId: factura.id, tipo: tipoFactura },
  })
}
