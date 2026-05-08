import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { resolveLogoUrl } from "@/services/storage/r2Service"

interface GuiaRow {
  folio: number | null
  fecha: string
  neto: number
  iva: number
  total: number
  track_id: string | null
  cliente_rut: string | null
  cliente_razon_social: string | null
}

interface ItemRow {
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return new NextResponse("No autenticado", { status: 401 })

  const [guia] = await prisma.$queryRawUnsafe<GuiaRow[]>(
    `SELECT g.folio, g.fecha, g.neto, g.iva, g.total, g.track_id,
            c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".guias g
     LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
     WHERE g.id = $1`,
    params.id
  )
  if (!guia) return new NextResponse("Guía no encontrada", { status: 404 })

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".guia_items WHERE guia_id = $1`,
    params.id
  )

  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  const logoUrl = await resolveLogoUrl(empresa.logoUrl)

  const pdfBuffer = await generarPdfDTE({
    tipo: 52,
    folio: guia.folio ?? 0,
    fecha: new Date(guia.fecha),
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
      rut: guia.cliente_rut ?? "66666666-6",
      razonSocial: guia.cliente_razon_social ?? "Traslado Interno",
    },
    items: items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precio_unitario),
      monto: Math.round(Number(i.cantidad) * Number(i.precio_unitario)),
    })),
    neto: Number(guia.neto),
    iva: Number(guia.iva),
    total: Number(guia.total),
    trackId: guia.track_id ?? "VISTA PREVIA",
    isPreview: true,
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    },
  })
}
