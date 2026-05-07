import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { resolveLogoUrl } from "@/services/storage/r2Service"

interface FacturaRow {
  tipo: number
  folio: number | null
  fecha: string
  neto: number
  iva: number
  total: number
  track_id: string | null
  cliente_rut: string
  cliente_razon_social: string
  cliente_giro: string | null
  cliente_direccion: string | null
  cliente_ciudad: string | null
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

  const [factura] = await prisma.$queryRawUnsafe<FacturaRow[]>(
    `SELECT f.tipo, f.folio, f.fecha, f.neto, f.iva, f.total, f.track_id,
            c.rut AS cliente_rut, c.razon_social AS cliente_razon_social,
            c.giro AS cliente_giro, c.direccion AS cliente_direccion, c.ciudad AS cliente_ciudad
     FROM "${ctx.schemaName}".facturas f
     JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
     WHERE f.id = $1`,
    params.id
  )
  if (!factura) return new NextResponse("Factura no encontrada", { status: 404 })

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
    params.id
  )

  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  const logoUrl = await resolveLogoUrl(empresa.logoUrl)

  const pdfBuffer = await generarPdfDTE({
    tipo: factura.tipo,
    folio: factura.folio ?? 0,
    fecha: new Date(factura.fecha),
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
    trackId: factura.track_id ?? "VISTA PREVIA",
    isPreview: true,
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    },
  })
}
