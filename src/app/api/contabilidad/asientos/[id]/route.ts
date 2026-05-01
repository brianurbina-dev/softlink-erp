import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface LineaDetalle {
  id: string
  cuenta_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  debe: number
  haber: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params

  const lineas = await prisma.$queryRawUnsafe<LineaDetalle[]>(
    `SELECT al.id, al.cuenta_id, pc.codigo AS cuenta_codigo, pc.nombre AS cuenta_nombre,
            al.debe::int, al.haber::int
     FROM "${ctx.schemaName}".asiento_lineas al
     JOIN "${ctx.schemaName}".plan_cuentas pc ON pc.id = al.cuenta_id
     WHERE al.asiento_id = $1
     ORDER BY al.debe DESC`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: lineas })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = await params

  const [asiento] = await prisma.$queryRawUnsafe<{ automatico: boolean }[]>(
    `SELECT automatico FROM "${ctx.schemaName}".asientos WHERE id = $1`,
    id
  )

  if (!asiento) return NextResponse.json<ApiResponse>({ error: "Asiento no encontrado" }, { status: 404 })
  if (asiento.automatico) {
    return NextResponse.json<ApiResponse>(
      { error: "No se pueden eliminar asientos automáticos" },
      { status: 409 }
    )
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".asientos WHERE id = $1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}
