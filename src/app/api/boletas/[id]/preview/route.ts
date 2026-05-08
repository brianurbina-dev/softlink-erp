import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { resolveLogoUrl } from "@/services/storage/r2Service"

interface BoletaRow {
  folio: number | null
  fecha: string
  neto: number
  iva: number
  total: number
  track_id: string | null
  receptor_rut: string | null
  receptor_nombre: string | null
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

  const [boleta] = await prisma.$queryRawUnsafe<BoletaRow[]>(
    `SELECT folio, fecha, neto, iva, total, track_id, receptor_rut, receptor_nombre
     FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )
  if (!boleta) return new NextResponse("Boleta no encontrada", { status: 404 })

  const items = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT descripcion, cantidad, precio_unitario
     FROM "${ctx.schemaName}".boleta_items WHERE boleta_id = $1`,
    params.id
  )

  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  const logoUrl = await resolveLogoUrl(empresa.logoUrl)

  const pdfBuffer = await generarPdfDTE({
    tipo: 39,
    folio: boleta.folio ?? 0,
    fecha: new Date(boleta.fecha),
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
      rut: boleta.receptor_rut ?? "66666666-6",
      razonSocial: boleta.receptor_nombre ?? "Consumidor Final",
    },
    items: items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precio_unitario),
      monto: Math.round(Number(i.cantidad) * Number(i.precio_unitario)),
    })),
    neto: Number(boleta.neto),
    iva: Number(boleta.iva),
    total: Number(boleta.total),
    trackId: boleta.track_id ?? "VISTA PREVIA",
    isPreview: true,
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    },
  })
}
