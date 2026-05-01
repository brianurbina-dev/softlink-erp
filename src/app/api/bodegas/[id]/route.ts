import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { bodegaSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"
import type { BodegaRow } from "../route"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const parsed = bodegaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { nombre, descripcion } = parsed.data

  const [bodega] = await prisma.$queryRawUnsafe<BodegaRow[]>(
    `UPDATE "${ctx.schemaName}".bodegas
     SET nombre = $1, descripcion = $2
     WHERE id = $3 RETURNING *`,
    nombre,
    descripcion || null,
    id
  )

  if (!bodega) {
    return NextResponse.json<ApiResponse>({ error: "Bodega no encontrada" }, { status: 404 })
  }

  return NextResponse.json<ApiResponse>({ data: bodega })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params
  const { activa } = await req.json() as { activa: boolean }

  const [bodega] = await prisma.$queryRawUnsafe<BodegaRow[]>(
    `UPDATE "${ctx.schemaName}".bodegas SET activa = $1 WHERE id = $2 RETURNING *`,
    activa,
    id
  )

  if (!bodega) {
    return NextResponse.json<ApiResponse>({ error: "Bodega no encontrada" }, { status: 404 })
  }

  return NextResponse.json<ApiResponse>({ data: bodega })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params

  const [ref] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "${ctx.schemaName}".inventario WHERE bodega_id = $1`,
    id
  )
  if ((ref?.n ?? 0) > 0) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar: la bodega tiene stock registrado" },
      { status: 409 }
    )
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".bodegas WHERE id = $1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { id } })
}
