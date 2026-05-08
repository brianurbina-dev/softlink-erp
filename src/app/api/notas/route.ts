import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { notaSchema } from "@/lib/validations/notas"
import { calcularIva } from "@/lib/chile/impuestos"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio } from "@/services/dte/cafService"
import type { ApiResponse } from "@/types"
import type { DatosNota } from "@/services/dte/DTEService"

export interface NotaRow {
  id: string
  tipo: number
  folio: number | null
  fecha: string
  cliente_rut: string
  cliente_razon_social: string
  referencia_tipo: number | null
  referencia_folio: number | null
  referencia_razon: string | null
  neto: number
  iva: number
  total: number
  estado: string
  track_id: string | null
  pdf_url: string | null
  creado_en: string
  email_estado: string | null
  email_destinatario: string | null
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const notas = await prisma.$queryRawUnsafe<NotaRow[]>(
    `SELECT f.*, c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.tipo IN (56, 61)
     ORDER BY f.creado_en DESC LIMIT 200`
  )

  return NextResponse.json<ApiResponse>({ data: notas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = notaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipo, clienteId, fecha, referenciaTipo, referenciaFolio, referenciaRazon, items } =
    parsed.data

  // Verify cliente
  const [cliente] = await prisma.$queryRawUnsafe<{
    id: string; rut: string; razon_social: string; giro: string | null; direccion: string | null
  }[]>(
    `SELECT id, rut, razon_social, giro, direccion
     FROM "${ctx.schemaName}".clientes WHERE id = $1`,
    clienteId
  )
  if (!cliente) return NextResponse.json<ApiResponse>({ error: "Cliente no encontrado" }, { status: 404 })

  // Calculate totals
  let neto = 0
  const computedItems = items.map((item) => {
    const bruto = item.precioUnitario * item.cantidad
    const descuentoAmt = Math.round(bruto * (item.descuento / 100))
    const subtotal = bruto - descuentoAmt
    neto += subtotal
    return { ...item, subtotal }
  })

  // NC/ND sobre facturas afectas llevan IVA; sobre exentas no
  const iva = referenciaTipo === 33 ? calcularIva(neto) : 0
  const total = neto + iva

  // Create nota in facturas table
  const [nota] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".facturas
     (tipo, fecha, cliente_id, neto, iva, total, estado,
      referencia_tipo, referencia_folio, referencia_razon)
     VALUES ($1, $2, $3, $4, $5, $6, 'borrador', $7, $8, $9)
     RETURNING id`,
    tipo, fecha, clienteId, neto, iva, total,
    referenciaTipo, referenciaFolio, referenciaRazon
  )

  for (const item of computedItems) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".factura_items
       (factura_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      nota.id,
      item.productoId ?? null,
      item.descripcion,
      item.cantidad,
      item.precioUnitario,
      item.descuento,
      item.subtotal
    )
  }

  // If emitir=true, emit immediately
  const emitir = (body as Record<string, unknown>).emitir === true
  if (!emitir) {
    return NextResponse.json<ApiResponse>({ data: { id: nota.id } }, { status: 201 })
  }

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, tipo, ctx.empresaId)
  } catch {
    return NextResponse.json<ApiResponse>(
      { error: "Nota guardada como borrador. No se pudo obtener folio DTE automáticamente." },
      { status: 201 }
    )
  }

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>(
      { error: "Nota creada como borrador. Configura API key para emitir." },
      { status: 201 }
    )
  }

  const datos: DatosNota = {
    tipo: tipo as 56 | 61,
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    clienteRut: cliente.rut,
    clienteRazonSocial: cliente.razon_social,
    clienteGiro: cliente.giro ?? "Actividades del giro",
    clienteDireccion: cliente.direccion ?? "Sin dirección",
    referenciaTipo,
    referenciaFolio,
    referenciaRazon,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      afectoIva: referenciaTipo === 33,
    })),
    fechaEmision: new Date(fecha),
  }

  const result = await dte.emitirNota(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>(
      { error: `Nota guardada como borrador. Error al emitir: ${result.error.message}` },
      { status: 201 }
    )
  }

  const { folio, trackId, pdfUrl } = result.data
  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".facturas
     SET folio = $1, track_id = $2, pdf_url = $3, estado = 'emitida'
     WHERE id = $4`,
    folio, trackId, pdfUrl ?? null, nota.id
  )

  return NextResponse.json<ApiResponse>({
    data: { id: nota.id, folio, trackId },
  }, { status: 201 })
}
