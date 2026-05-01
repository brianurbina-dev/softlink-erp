import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { cuentaSchema } from "@/lib/validations/contabilidad"
import type { ApiResponse } from "@/types"
import type { CuentaRow } from "../route"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = cuentaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { codigo, nombre, tipo, subtipo, cuentaPadreId, aceptaMovimientos } = parsed.data

  const [dup] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".plan_cuentas WHERE codigo = $1 AND id != $2`,
    codigo,
    id
  )
  if (dup) {
    return NextResponse.json<ApiResponse>({ error: `El código ${codigo} ya existe` }, { status: 409 })
  }

  const [cuenta] = await prisma.$queryRawUnsafe<CuentaRow[]>(
    `UPDATE "${ctx.schemaName}".plan_cuentas
     SET codigo=$1, nombre=$2, tipo=$3, subtipo=$4, cuenta_padre_id=$5, acepta_movimientos=$6
     WHERE id=$7
     RETURNING *`,
    codigo,
    nombre,
    tipo,
    subtipo || null,
    cuentaPadreId || null,
    aceptaMovimientos,
    id
  )

  if (!cuenta) return NextResponse.json<ApiResponse>({ error: "Cuenta no encontrada" }, { status: 404 })
  return NextResponse.json<ApiResponse>({ data: cuenta })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const { activo } = await req.json()

  const [cuenta] = await prisma.$queryRawUnsafe<CuentaRow[]>(
    `UPDATE "${ctx.schemaName}".plan_cuentas SET activo=$1 WHERE id=$2 RETURNING *`,
    activo,
    id
  )

  if (!cuenta) return NextResponse.json<ApiResponse>({ error: "Cuenta no encontrada" }, { status: 404 })
  return NextResponse.json<ApiResponse>({ data: cuenta })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params

  const [hijo] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".plan_cuentas WHERE cuenta_padre_id=$1 LIMIT 1`,
    id
  )
  if (hijo) {
    return NextResponse.json<ApiResponse>({ error: "No se puede eliminar una cuenta con subcuentas" }, { status: 409 })
  }

  await prisma.$queryRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".plan_cuentas WHERE id=$1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}
