import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { actividadSchema } from "@/lib/validations/crm"
import type { ApiResponse } from "@/types"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const rows = await prisma.$queryRawUnsafe<{
    id: string
    oportunidad_id: string
    tipo: string
    descripcion: string
    fecha: string
    completada: boolean
    creado_en: string
  }[]>(
    `SELECT * FROM "${s}".crm_actividades
     WHERE oportunidad_id = $1
     ORDER BY fecha DESC, creado_en DESC`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = actividadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { tipo, descripcion, fecha, completada } = parsed.data

  const [actividad] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${s}".crm_actividades (oportunidad_id, tipo, descripcion, fecha, completada)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    params.id,
    tipo,
    descripcion,
    fecha,
    completada
  )

  return NextResponse.json<ApiResponse>({ data: { id: actividad.id } }, { status: 201 })
}
