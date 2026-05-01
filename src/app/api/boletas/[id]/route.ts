import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [boleta] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${ctx.schemaName}".boletas WHERE id = $1`,
    params.id
  )
  if (!boleta) return NextResponse.json<ApiResponse>({ error: "Boleta no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT bi.*, p.codigo AS producto_codigo
     FROM "${ctx.schemaName}".boleta_items bi
     LEFT JOIN "${ctx.schemaName}".productos p ON p.id = bi.producto_id
     WHERE bi.boleta_id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...boleta, items } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [deleted] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `DELETE FROM "${ctx.schemaName}".boletas WHERE id = $1 AND estado = 'borrador' RETURNING id`,
    params.id
  )

  if (!deleted) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar (no existe o ya fue emitida)" },
      { status: 400 }
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: params.id } })
}
