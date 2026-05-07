import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { resolveLogoUrl } from "@/services/storage/r2Service"
import { calcularIva } from "@/lib/chile/impuestos"

const schema = z.object({
  tipo: z.union([z.literal(33), z.literal(34)]),
  clienteId: z.string().min(1),
  fecha: z.string().min(1),
  items: z
    .array(
      z.object({
        descripcion: z.string(),
        cantidad: z.number().int().positive(),
        precioUnitario: z.number().nonnegative(),
        descuento: z.number().min(0).max(100).default(0),
      })
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return new NextResponse("No autenticado", { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return new NextResponse(parsed.error.issues[0].message, { status: 400 })
  }

  const { tipo, clienteId, fecha, items } = parsed.data

  const [cliente] = await prisma.$queryRawUnsafe<
    { rut: string; razon_social: string; giro: string | null; direccion: string | null; ciudad: string | null }[]
  >(
    `SELECT rut, razon_social, giro, direccion, ciudad FROM "${ctx.schemaName}".clientes WHERE id = $1`,
    clienteId
  )
  if (!cliente) return new NextResponse("Cliente no encontrado", { status: 404 })

  const [empresa, config] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
  ])
  if (!empresa) return new NextResponse("Empresa no encontrada", { status: 404 })

  let neto = 0
  const pdfItems = items.map((i) => {
    const bruto = i.precioUnitario * i.cantidad
    const subtotal = bruto - Math.round(bruto * (i.descuento / 100))
    neto += subtotal
    return { descripcion: i.descripcion, cantidad: i.cantidad, precioUnitario: i.precioUnitario, monto: subtotal }
  })

  const iva = tipo === 33 ? calcularIva(neto) : 0
  const total = neto + iva
  const logoUrl = await resolveLogoUrl(empresa.logoUrl)

  const pdfBuffer = await generarPdfDTE({
    tipo,
    folio: 0,
    fecha: new Date(fecha),
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
      rut: cliente.rut,
      razonSocial: cliente.razon_social,
      giro: cliente.giro ?? undefined,
      direccion: cliente.direccion ?? undefined,
      ciudad: cliente.ciudad ?? undefined,
    },
    items: pdfItems,
    neto,
    iva,
    total,
    trackId: "VISTA PREVIA",
    isPreview: true,
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    },
  })
}
