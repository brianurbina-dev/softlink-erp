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

  const [guia] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT g.*, c.rut AS cliente_rut, c.razon_social AS cliente_razon_social
     FROM "${ctx.schemaName}".guias g
     LEFT JOIN "${ctx.schemaName}".clientes c ON c.id = g.cliente_id
     WHERE g.id = $1`,
    params.id
  )
  if (!guia) return NextResponse.json<ApiResponse>({ error: "Guía no encontrada" }, { status: 404 })

  const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT gi.*, p.codigo AS producto_codigo
     FROM "${ctx.schemaName}".guia_items gi
     LEFT JOIN "${ctx.schemaName}".productos p ON p.id = gi.producto_id
     WHERE gi.guia_id = $1`,
    params.id
  )

  return NextResponse.json<ApiResponse>({ data: { ...guia, items } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [deleted] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `DELETE FROM "${ctx.schemaName}".guias WHERE id = $1 AND estado = 'borrador' RETURNING id`,
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
