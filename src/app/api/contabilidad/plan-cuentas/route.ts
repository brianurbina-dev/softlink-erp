import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { cuentaSchema } from "@/lib/validations/contabilidad"
import type { ApiResponse } from "@/types"

export interface CuentaRow {
  id: string
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  cuenta_padre_id: string | null
  acepta_movimientos: boolean
  activo: boolean
  creado_en: string
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const cuentas = await prisma.$queryRawUnsafe<CuentaRow[]>(
    `SELECT * FROM "${ctx.schemaName}".plan_cuentas ORDER BY codigo`
  )

  return NextResponse.json<ApiResponse>({ data: cuentas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = cuentaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { codigo, nombre, tipo, subtipo, cuentaPadreId, aceptaMovimientos } = parsed.data

  const [existing] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".plan_cuentas WHERE codigo = $1`,
    codigo
  )
  if (existing) {
    return NextResponse.json<ApiResponse>({ error: `El código ${codigo} ya existe` }, { status: 409 })
  }

  const [cuenta] = await prisma.$queryRawUnsafe<CuentaRow[]>(
    `INSERT INTO "${ctx.schemaName}".plan_cuentas
       (codigo, nombre, tipo, subtipo, cuenta_padre_id, acepta_movimientos)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    codigo,
    nombre,
    tipo,
    subtipo || null,
    cuentaPadreId || null,
    aceptaMovimientos
  )

  return NextResponse.json<ApiResponse>({ data: cuenta }, { status: 201 })
}
