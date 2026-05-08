import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { sendDteEmail } from "@/services/email/emailService"
import type { ApiResponse } from "@/types"
import { z } from "zod"

const bodySchema = z.object({
  documentoTipo: z.enum(["factura", "boleta", "guia", "nota"]),
  documentoId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { documentoTipo, documentoId } = parsed.data

  const [empresa] = await prisma.$queryRawUnsafe<
    { razon_social: string; rut: string }[]
  >(
    `SELECT razon_social, rut FROM public.empresas WHERE id = $1`,
    ctx.empresaId
  )
  if (!empresa) {
    return NextResponse.json<ApiResponse>({ error: "Empresa no encontrada" }, { status: 404 })
  }

  try {
    if (documentoTipo === "factura" || documentoTipo === "nota") {
      const [doc] = await prisma.$queryRawUnsafe<
        {
          id: string; tipo: number; folio: number; fecha: string; track_id: string | null
          neto: number; iva: number; total: number; estado: string
          cliente_rut: string; cliente_razon_social: string; cliente_email: string | null
        }[]
      >(
        `SELECT f.id, f.tipo, f.folio, f.fecha, f.track_id, f.neto, f.iva, f.total, f.estado,
                c.rut AS cliente_rut, c.razon_social AS cliente_razon_social, c.email AS cliente_email
         FROM "${ctx.schemaName}".facturas f
         JOIN "${ctx.schemaName}".clientes c ON c.id = f.cliente_id
         WHERE f.id = $1`,
        documentoId
      )
      if (!doc || doc.estado !== "emitida") {
        return NextResponse.json<ApiResponse>(
          { error: "Documento no encontrado o no emitido" },
          { status: 404 }
        )
      }
      const items = await prisma.$queryRawUnsafe<
        { descripcion: string; cantidad: number; precio_unitario: number }[]
      >(
        `SELECT descripcion, cantidad, precio_unitario
         FROM "${ctx.schemaName}".factura_items WHERE factura_id = $1`,
        documentoId
      )
      await sendDteEmail({
        schemaName: ctx.schemaName,
        documentoTipo,
        documentoId,
        tipoDte: doc.tipo,
        folio: doc.folio,
        fecha: new Date(doc.fecha),
        trackId: doc.track_id ?? "",
        emisorNombre: empresa.razon_social,
        emisorRut: empresa.rut,
        receptorNombre: doc.cliente_razon_social,
        receptorRut: doc.cliente_rut,
        receptorEmail: doc.cliente_email,
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
          monto: Math.round(Number(i.cantidad) * Number(i.precio_unitario)),
        })),
        neto: Number(doc.neto),
        iva: Number(doc.iva),
        total: Number(doc.total),
        empresaRut: empresa.rut,
      })
    } else if (documentoTipo === "boleta") {
      const [doc] = await prisma.$queryRawUnsafe<
        {
          id: string; folio: number; fecha: string; track_id: string | null
          neto: number; iva: number; total: number; estado: string
          receptor_rut: string | null; receptor_nombre: string | null
        }[]
      >(
        `SELECT id, folio, fecha, track_id, neto, iva, total, estado, receptor_rut, receptor_nombre
         FROM "${ctx.schemaName}".boletas WHERE id = $1`,
        documentoId
      )
      if (!doc || doc.estado !== "emitida") {
        return NextResponse.json<ApiResponse>(
          { error: "Documento no encontrado o no emitido" },
          { status: 404 }
        )
      }
      const items = await prisma.$queryRawUnsafe<
        { descripcion: string; cantidad: number; precio_unitario: number }[]
      >(
        `SELECT descripcion, cantidad, precio_unitario
         FROM "${ctx.schemaName}".boleta_items WHERE boleta_id = $1`,
        documentoId
      )
      await sendDteEmail({
        schemaName: ctx.schemaName,
        documentoTipo: "boleta",
        documentoId,
        tipoDte: 39,
        folio: doc.folio,
        fecha: new Date(doc.fecha),
        trackId: doc.track_id ?? "",
        emisorNombre: empresa.razon_social,
        emisorRut: empresa.rut,
        receptorNombre: doc.receptor_nombre ?? "Consumidor Final",
        receptorRut: doc.receptor_rut ?? "66666666-6",
        receptorEmail: null,
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
          monto: Math.round(Number(i.cantidad) * Number(i.precio_unitario)),
        })),
        neto: Number(doc.neto),
        iva: Number(doc.iva),
        total: Number(doc.total),
        empresaRut: empresa.rut,
      })
    } else if (documentoTipo === "guia") {
      const [doc] = await prisma.$queryRawUnsafe<
        {
          id: string; folio: number; fecha: string; track_id: string | null
          tipo_traslado: number; neto: number; iva: number; total: number; estado: string
          cliente_rut: string | null; cliente_razon_social: string | null; cliente_email: string | null
        }[]
      >(
        `SELECT g.id, g.folio, g.fecha, g.track_id, g.tipo_traslado, g.neto, g.iva, g.total, g.estado,
                c.rut AS cliente_rut, c.razon_social AS cliente_razon_social, c.email AS cliente_email
         FROM "${ctx.schemaName}".guias g
         LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
         WHERE g.id = $1`,
        documentoId
      )
      if (!doc || doc.estado === "borrador") {
        return NextResponse.json<ApiResponse>(
          { error: "Documento no encontrado o no emitido" },
          { status: 404 }
        )
      }
      const items = await prisma.$queryRawUnsafe<
        { descripcion: string; cantidad: number; precio_unitario: number }[]
      >(
        `SELECT descripcion, cantidad, precio_unitario
         FROM "${ctx.schemaName}".guia_items WHERE guia_id = $1`,
        documentoId
      )
      await sendDteEmail({
        schemaName: ctx.schemaName,
        documentoTipo: "guia",
        documentoId,
        tipoDte: 52,
        folio: doc.folio,
        fecha: new Date(doc.fecha),
        trackId: doc.track_id ?? "",
        emisorNombre: empresa.razon_social,
        emisorRut: empresa.rut,
        receptorNombre: doc.cliente_razon_social ?? "Traslado Interno",
        receptorRut: doc.cliente_rut ?? "66666666-6",
        receptorEmail: doc.cliente_email,
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
          monto: Math.round(Number(i.cantidad) * Number(i.precio_unitario)),
        })),
        neto: Number(doc.neto),
        iva: Number(doc.iva),
        total: Number(doc.total),
        empresaRut: empresa.rut,
      })
    }

    return NextResponse.json<ApiResponse>({ data: { ok: true } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al reenviar"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 500 })
  }
}
