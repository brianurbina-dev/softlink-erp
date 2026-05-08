import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { getDTEService } from "@/services/dte/getDTEService"
import { ensureFolio, confirmarFolio } from "@/services/dte/cafService"
import { storeDTE } from "@/services/dte/dteStorageService"
import { resolveLogoUrl } from "@/services/storage/r2Service"
import type { ApiResponse } from "@/types"
import type { DatosGuia } from "@/services/dte/DTEService"

interface GuiaRow {
  id: string
  tipo_traslado: number
  fecha: string
  estado: string
  neto: number
  iva: number
  total: number
  cliente_rut: string | null
  cliente_razon_social: string | null
  cliente_giro: string | null
  cliente_direccion: string | null
  cliente_email: string | null
  cliente_ciudad: string | null
  direccion_destino: string | null
  transportista_rut: string | null
  transportista_nombre: string | null
  patente: string | null
  ref_tipo: number | null
  ref_folio: number | null
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

  const [guia] = await prisma.$queryRawUnsafe<GuiaRow[]>(
    `SELECT g.id, g.tipo_traslado, g.fecha, g.estado, g.neto, g.iva, g.total,
            g.direccion_destino, g.transportista_rut, g.transportista_nombre, g.patente,
            g.ref_tipo, g.ref_folio,
            c.rut        AS cliente_rut,
            c.razon_social AS cliente_razon_social,
            c.giro         AS cliente_giro,
            c.direccion    AS cliente_direccion,
            c.ciudad       AS cliente_ciudad,
            c.email        AS cliente_email
     FROM "${ctx.schemaName}".guias g
     LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
     WHERE g.id = $1`,
    params.id
  )

  if (!guia) return NextResponse.json<ApiResponse>({ error: "Guía no encontrada" }, { status: 404 })
  if (guia.estado !== "borrador") {
    return NextResponse.json<ApiResponse>({ error: "Solo se pueden emitir guías en borrador" }, { status: 400 })
  }

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".guia_items WHERE guia_id = $1`,
    params.id
  )

  if (items.length === 0) {
    return NextResponse.json<ApiResponse>({ error: "La guía no tiene ítems" }, { status: 400 })
  }

  let reserva: { folio: number; cafXml: string }
  try {
    reserva = await ensureFolio(ctx.schemaName, 52, ctx.empresaId)
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

  const datos: DatosGuia = {
    folio: reserva.folio,
    cafXml: reserva.cafXml,
    tipoTraslado: guia.tipo_traslado,
    clienteRut: guia.cliente_rut ?? undefined,
    clienteRazonSocial: guia.cliente_razon_social ?? undefined,
    clienteGiro: guia.cliente_giro ?? undefined,
    clienteDireccion: guia.cliente_direccion ?? undefined,
    clienteComuna: guia.cliente_ciudad ?? undefined,
    direccionDestino: guia.direccion_destino ?? undefined,
    transportistaRut: guia.transportista_rut ?? undefined,
    transportistaNombre: guia.transportista_nombre ?? undefined,
    patente: guia.patente ?? undefined,
    items: items.map((i) => ({
      nombre: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      afectoIva: guia.tipo_traslado === 1,
    })),
    fechaEmision: new Date(guia.fecha),
    ...(guia.ref_tipo && guia.ref_folio
      ? {
          referenciaTipo: guia.ref_tipo,
          referenciaFolio: guia.ref_folio,
          referenciaRazon: `Despacho según factura N° ${guia.ref_folio}`,
        }
      : {}),
  }

  const result = await dte.emitirGuia(datos)
  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  const { folio, trackId, dteXml } = result.data

  await confirmarFolio(ctx.schemaName, 52)

  await prisma.$queryRawUnsafe(
    `UPDATE "${ctx.schemaName}".guias SET folio = $1, track_id = $2, estado = 'emitida' WHERE id = $3`,
    folio, trackId, params.id
  )

  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])

  let pdfUrl: string | null = null
  if (empresa) {
    const logoUrl = await resolveLogoUrl(empresa.logoUrl)
    pdfUrl = await storeDTE({
      docType: "guias",
      docId: params.id,
      tipo: 52,
      folio,
      fecha: new Date(guia.fecha),
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
        rut: guia.cliente_rut ?? undefined,
        razonSocial: guia.cliente_razon_social ?? undefined,
        giro: guia.cliente_giro ?? undefined,
        direccion: guia.cliente_direccion ?? undefined,
        ciudad: guia.cliente_ciudad ?? undefined,
      },
      items: items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
        monto: Math.round(i.cantidad * i.precio_unitario),
      })),
      neto: guia.neto,
      iva: guia.iva,
      total: guia.total,
      tipoTraslado: guia.tipo_traslado,
      referenciaFolio: guia.ref_folio ?? undefined,
      referenciaTipo: guia.ref_tipo ?? undefined,
      referenciaRazon: guia.ref_folio ? `Despacho según factura N° ${guia.ref_folio}` : undefined,
    })

    if (pdfUrl) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${ctx.schemaName}".guias SET pdf_url = $1 WHERE id = $2`,
        pdfUrl, params.id
      )
    }
  }

  return NextResponse.json<ApiResponse>({ data: { folio, trackId, pdfUrl } })
}
