import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { bodegaSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export interface BodegaRow {
  id: string
  nombre: string
  descripcion: string | null
  activa: boolean
  creado_en: string
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const bodegas = await prisma.$queryRawUnsafe<BodegaRow[]>(
    `SELECT * FROM "${ctx.schemaName}".bodegas ORDER BY nombre`
  )

  return NextResponse.json<ApiResponse>({ data: bodegas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = bodegaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { nombre, descripcion } = parsed.data

  const [bodega] = await prisma.$queryRawUnsafe<BodegaRow[]>(
    `INSERT INTO "${ctx.schemaName}".bodegas (nombre, descripcion)
     VALUES ($1, $2) RETURNING *`,
    nombre,
    descripcion || null
  )

  return NextResponse.json<ApiResponse>({ data: bodega }, { status: 201 })
}
