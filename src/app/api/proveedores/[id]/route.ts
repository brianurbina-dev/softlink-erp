import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { proveedorSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"
import type { ProveedorRow } from "../route"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const parsed = proveedorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { rut, razonSocial, giro, email, telefono, direccion, ciudad } = parsed.data

  const [dup] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".proveedores WHERE rut = $1 AND id != $2 LIMIT 1`,
    rut,
    id
  )
  if (dup) {
    return NextResponse.json<ApiResponse>({ error: "Ya existe un proveedor con ese RUT" }, { status: 409 })
  }

  const [proveedor] = await prisma.$queryRawUnsafe<ProveedorRow[]>(
    `UPDATE "${ctx.schemaName}".proveedores
     SET rut = $1, razon_social = $2, giro = $3, email = $4, telefono = $5, direccion = $6, ciudad = $7
     WHERE id = $8 RETURNING *`,
    rut,
    razonSocial,
    giro || null,
    email || null,
    telefono || null,
    direccion || null,
    ciudad || null,
    id
  )

  if (!proveedor) {
    return NextResponse.json<ApiResponse>({ error: "Proveedor no encontrado" }, { status: 404 })
  }

  return NextResponse.json<ApiResponse>({ data: proveedor })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { id } = params

  const [ref] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "${ctx.schemaName}".compras WHERE proveedor_id = $1`,
    id
  )
  if ((ref?.n ?? 0) > 0) {
    return NextResponse.json<ApiResponse>(
      { error: "No se puede eliminar: el proveedor tiene compras registradas" },
      { status: 409 }
    )
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${ctx.schemaName}".proveedores WHERE id = $1`,
    id
  )

  return NextResponse.json<ApiResponse>({ data: { id } })
}
