import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import type { ApiResponse } from "@/types"
import type { DatosNota } from "@/services/dte/DTEService"

interface FacturaWithCliente {
  id: string
  tipo: number
  folio: number
  fecha: string
  estado: string
  neto: number
  iva: number
  total: number
  cliente_rut: string
  cliente_razon_social: string
  cliente_giro: string | null
  cliente_direccion: string | null
}

interface ItemRow {
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [factura] = await prisma.$queryRawUnsafe<FacturaWithCliente[]>(
    `SELECT f.id, f.tipo, f.folio, f.fecha, f.estado, f.neto, f.iva, f.total,
            c.rut AS cliente_rut, c.razon_social AS cliente_razon_social,
            c.giro AS cliente_giro, c.direccion AS cliente_direccion
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1`,
    params.id
  )

  if (!factura) return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })
  if (factura.estado !== "emitida") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden anular facturas emitidas" }, { status: 400 })
  }
  if (!factura.folio) {
    return NextResponse.json<ApiResponse>({ error: "La factura no tiene folio asignado" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>(
      { error: "Configura el API key DTE antes de anular" },
      { status: 400 }
    )
  }

  const datos: DatosNota = {
    tipo: 61,
    clienteRut: factura.cliente_rut,
    clienteRazonSocial: factura.cliente_razon_social,
    clienteGiro: factura.cliente_giro ?? "Actividades del giro",
    clienteDireccion: factura.cliente_direccion ?? "Sin dirección",
    referenciaTipo: factura.tipo,
    referenciaFolio: factura.folio,
    referenciaRazon: "Anulación de documento",
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: factura.tipo === 33,
    })),
    fechaEmision: new Date(),
  }

  const result = await dte.emitirNota(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio: ncFolio, trackId, pdfUrl } = result.data
  const hoy = new Date().toISOString().split("T")[0]

  // Get the cliente_id from original factura
  const [orig] = await prisma.$queryRawUnsafe<{ cliente_id: string }[]>(
    `SELECT cliente_id FROM "${ctx.schemaName}".facturas WHERE id = $1`,
    params.id
  )

  // Create NC record in facturas table
  const [nc] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".facturas
     (tipo, folio, fecha, cliente_id, neto, iva, total, estado,
      referencia_tipo, referencia_folio, referencia_razon, track_id, pdf_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'emitida', $8, $9, $10, $11, $12)
     RETURNING id`,
    61, ncFolio, hoy, orig.cliente_id,
    factura.neto, factura.iva, factura.total,
    factura.tipo, factura.folio, "Anulación de documento",
    trackId, pdfUrl ?? null
  )

  // Insert NC items
  for (const item of items) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".factura_items
       (factura_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      nc.id, item.descripcion, item.cantidad, item.precio_unitario,
      item.precio_unitario * item.cantidad
    )
  }

  // Mark original factura as anulada
  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".facturas SET estado = 'anulada' WHERE id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({
    data: { ncId: nc.id, ncFolio, trackId, pdfUrl },
  })
}
