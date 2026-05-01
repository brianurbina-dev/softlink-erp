import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { proveedorSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export interface ProveedorRow {
  id: string
  rut: string
  razon_social: string
  giro: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  activo: boolean
  creado_en: string
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const search = req.nextUrl.searchParams.get("search")?.trim()

  let proveedores: ProveedorRow[]
  if (search) {
    proveedores = await prisma.$queryRawUnsafe<ProveedorRow[]>(
      `SELECT * FROM "${ctx.schemaName}".proveedores
       WHERE activo = true AND (razon_social ILIKE $1 OR rut ILIKE $1)
       ORDER BY razon_social LIMIT 500`,
      `%${search}%`
    )
  } else {
    proveedores = await prisma.$queryRawUnsafe<ProveedorRow[]>(
      `SELECT * FROM "${ctx.schemaName}".proveedores
       WHERE activo = true ORDER BY razon_social LIMIT 500`
    )
  }

  return NextResponse.json<ApiResponse>({ data: proveedores })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = proveedorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { rut, razonSocial, giro, email, telefono, direccion, ciudad } = parsed.data

  const [existing] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".proveedores WHERE rut = $1 LIMIT 1`,
    rut
  )
  if (existing) {
    return NextResponse.json<ApiResponse>({ error: "Ya existe un proveedor con ese RUT" }, { status: 409 })
  }

  const [proveedor] = await prisma.$queryRawUnsafe<ProveedorRow[]>(
    `INSERT INTO "${ctx.schemaName}".proveedores (rut, razon_social, giro, email, telefono, direccion, ciudad)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    rut,
    razonSocial,
    giro || null,
    email || null,
    telefono || null,
    direccion || null,
    ciudad || null
  )

  return NextResponse.json<ApiResponse>({ data: proveedor }, { status: 201 })
}
