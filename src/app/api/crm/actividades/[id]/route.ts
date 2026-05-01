import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json() as { completada?: boolean; descripcion?: string; tipo?: string; fecha?: string }

  const updates: string[] = []
  const args: unknown[] = []

  if (typeof body.completada === "boolean") {
    args.push(body.completada)
    updates.push(`completada = $${args.length}`)
  }
  if (body.descripcion) {
    args.push(body.descripcion)
    updates.push(`descripcion = $${args.length}`)
  }
  if (body.tipo) {
    args.push(body.tipo)
    updates.push(`tipo = $${args.length}`)
  }
  if (body.fecha) {
    args.push(body.fecha)
    updates.push(`fecha = $${args.length}`)
  }

  if (updates.length === 0) {
    return NextResponse.json<ApiResponse>({ error: "Sin campos para actualizar" }, { status: 400 })
  }

  args.push(params.id)
  const [row] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "${s}".crm_actividades SET ${updates.join(", ")} WHERE id = $${args.length} RETURNING id`,
    ...args
  )

  if (!row) return NextResponse.json<ApiResponse>({ error: "Actividad no encontrada" }, { status: 404 })
  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".crm_actividades WHERE id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}
