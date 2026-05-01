import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { oportunidadSchema } from "@/lib/validations/crm"
import type { ApiResponse } from "@/types"

export interface OportunidadRow {
  id: string
  cliente_id: string | null
  cliente_razon_social: string | null
  titulo: string
  descripcion: string | null
  valor_estimado: number
  etapa: string
  fecha_cierre_estimada: string | null
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const etapa = req.nextUrl.searchParams.get("etapa")

  const args: unknown[] = []
  const conditions: string[] = []

  if (etapa) {
    args.push(etapa)
    conditions.push(`o.etapa = $${args.length}`)
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""

  const rows = await prisma.$queryRawUnsafe<OportunidadRow[]>(
    `SELECT o.*, c.razon_social AS cliente_razon_social
     FROM "${s}".oportunidades o
     LEFT JOIN "${s}".clientes c ON c.id = o.cliente_id
     WHERE 1=1 ${where}
     ORDER BY o.creado_en DESC`,
    ...args
  )

  return NextResponse.json<ApiResponse>({ data: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const body = await req.json()
  const parsed = oportunidadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { clienteId, titulo, descripcion, valorEstimado, etapa, fechaCierreEstimada } = parsed.data

  const [oportunidad] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${s}".oportunidades
       (cliente_id, titulo, descripcion, valor_estimado, etapa, fecha_cierre_estimada)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    clienteId ?? null,
    titulo,
    descripcion || null,
    valorEstimado,
    etapa,
    fechaCierreEstimada ?? null
  )

  return NextResponse.json<ApiResponse>({ data: { id: oportunidad.id } }, { status: 201 })
}
