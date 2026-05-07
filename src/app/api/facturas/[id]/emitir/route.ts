import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio, confirmarFolio } from "@/services/dte/cafService"
import { crearAsientoAutomatico } from "@/services/contabilidad/asientosService"
import { storeDTE } from "@/services/dte/dteStorageService"
import { resolveLogoUrl } from "@/services/storage/r2Service"
import type { ApiResponse } from "@/types"
import type { DatosFactura } from "@/services/dte/DTEService"

interface FacturaRow {
  id: string
  tipo: number
  fecha: string
  estado: string
  neto: number
  iva: number
  total: number
  cliente_rut: string
  cliente_razon_social: string
  cliente_giro: string | null
  cliente_direccion: string | null
  cliente_ciudad: string | null
  cliente_email: string | null
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

  const [factura] = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT f.id, f.tipo, f.fecha, f.estado, f.neto, f.iva, f.total,
            c.rut         AS cliente_rut,
            c.razon_social AS cliente_razon_social,
            c.giro         AS cliente_giro,
            c.direccion    AS cliente_direccion,
            c.ciudad       AS cliente_ciudad,
            c.email        AS cliente_email
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1`,
    params.id
  )

  if (!factura) {
    return NextResponse.json<ApiResponse>({ error: "Factura no encontrada" }, { status: 404 })
  }
  if (factura.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden emitir borradores" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  if (items.length === 0) {
    return NextResponse.json<ApiResponse>({ error: "La factura no tiene ítems" }, { status: 400 })
  }

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, factura.tipo, ctx.empresaId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener folio DTE"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 400 })
  }

  const dte = await getDTEService(ctx.empresaId)
  if (!dte) {
    return NextResponse.json<ApiResponse>(
      { error: "Configura el API key y certificado DTE antes de emitir" },
      { status: 400 }
    )
  }

  const datos: DatosFactura = {
    tipo: factura.tipo as 33 | 34,
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    clienteRut: factura.cliente_rut,
    clienteRazonSocial: factura.cliente_razon_social,
    clienteGiro: factura.cliente_giro ?? "Actividades del giro",
    clienteDireccion: factura.cliente_direccion ?? "Sin dirección",
    clienteComuna: factura.cliente_ciudad ?? undefined,
    clienteContacto: factura.cliente_email ?? undefined,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: factura.tipo === 33,
    })),
    fechaEmision: new Date(factura.fecha),
  }

  const result = await dte.emitirFactura(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, dteXml } = result.data

  await confirmarFolio(ctx.schemaName, factura.tipo)

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".facturas SET folio = $1, track_id = $2, estado = 'emitida' WHERE id = $3`,
    folio, trackId, params.id
  )

  await crearAsientoAutomatico(
    ctx.schemaName,
    "factura_emitida",
    { neto: factura.neto, iva: factura.iva, total: factura.total },
    `Factura N° ${folio}`,
    "factura",
    params.id
  )

  // Store XML + PDF in R2 (fire and update pdf_url if successful)
  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])

  let pdfUrl: string | null = null
  if (empresa) {
    const logoUrl = await resolveLogoUrl(empresa.logoUrl)
    pdfUrl = await storeDTE({
      docType: "facturas",
      docId: params.id,
      tipo: factura.tipo,
      folio,
      fecha: new Date(factura.fecha),
      trackId,
      dteXml,
      empresaRut: empresa.rut,
      emisor: {
        rut: empresa.rut,
        razonSocial: empresa.razonSocial,
        giro: empresa.giro ?? "Actividades del giro",
        direccion: empresa.direccion ?? "",
        ciudad: empresa.ciudad ?? "",
        telefono: empresa.telefono ?? "",
        numeroResolucion: config?.numeroResolucion ?? 0,
        fechaResolucion: config?.fechaResolucion ?? "",
        logoUrl,
      },
      receptor: {
        rut: factura.cliente_rut,
        razonSocial: factura.cliente_razon_social,
        giro: factura.cliente_giro ?? undefined,
        direccion: factura.cliente_direccion ?? undefined,
        ciudad: factura.cliente_ciudad ?? undefined,
      },
      items: items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
        monto: Math.round(i.cantidad * i.precio_unitario),
      })),
      neto: factura.neto,
      iva: factura.iva,
      total: factura.total,
    })

    if (pdfUrl) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${ctx.schemaName}".facturas SET pdf_url = $1 WHERE id = $2`,
        pdfUrl, params.id
      )
    }
  }

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
