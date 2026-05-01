import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".reglas_contables WHERE id = $1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const { activo } = await req.json()

  await prisma.$executeRawUnsafe(
    `UPDATE "${ctx.schemaName}".reglas_contables SET activo=$1 WHERE id=$2`,
    activo,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}
