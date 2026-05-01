import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { oportunidadSchema, ETAPAS_CRM } from "@/lib/validations/crm"
import type { ApiResponse } from "@/types"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = oportunidadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { clienteId, titulo, descripcion, valorEstimado, etapa, fechaCierreEstimada } = parsed.data

  const [row] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "${s}".oportunidades
     SET cliente_id = $1, titulo = $2, descripcion = $3,
         valor_estimado = $4, etapa = $5, fecha_cierre_estimada = $6
     WHERE id = $7
     RETURNING id`,
    clienteId ?? null,
    titulo,
    descripcion || null,
    valorEstimado,
    etapa,
    fechaCierreEstimada ?? null,
    params.id
  )

  if (!row) return NextResponse.json<ApiResponse>({ error: "Oportunidad no encontrada" }, { status: 404 })
  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const { etapa } = await req.json() as { etapa: string }

  if (!ETAPAS_CRM.includes(etapa as typeof ETAPAS_CRM[number])) {
    return NextResponse.json<ApiResponse>({ error: "Etapa inválida" }, { status: 400 })
  }

  const [row] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "${s}".oportunidades SET etapa = $1 WHERE id = $2 RETURNING id`,
    etapa, params.id
  )

  if (!row) return NextResponse.json<ApiResponse>({ error: "Oportunidad no encontrada" }, { status: 404 })
  return NextResponse.json<ApiResponse>({ data: { id: params.id, etapa } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".oportunidades WHERE id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}
