import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { clienteSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export interface ClienteRow {
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

  let clientes: ClienteRow[]
  if (search) {
    clientes = await prisma.$queryRawUnsafe<ClienteRow[]>(
      `SELECT * FROM "${ctx.schemaName}".clientes
       WHERE activo = true AND (razon_social ILIKE $1 OR rut ILIKE $1)
       ORDER BY razon_social LIMIT 500`,
      `%${search}%`
    )
  } else {
    clientes = await prisma.$queryRawUnsafe<ClienteRow[]>(
      `SELECT * FROM "${ctx.schemaName}".clientes
       WHERE activo = true ORDER BY razon_social LIMIT 500`
    )
  }

  return NextResponse.json<ApiResponse>({ data: clientes })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = clienteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { rut, razonSocial, giro, email, telefono, direccion, ciudad } = parsed.data

  const [existing] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".clientes WHERE rut = $1 LIMIT 1`,
    rut
  )
  if (existing) {
    return NextResponse.json<ApiResponse>({ error: "Ya existe un cliente con ese RUT" }, { status: 409 })
  }

  const [cliente] = await prisma.$queryRawUnsafe<ClienteRow[]>(
    `INSERT INTO "${ctx.schemaName}".clientes (rut, razon_social, giro, email, telefono, direccion, ciudad)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    rut,
    razonSocial,
    giro || null,
    email || null,
    telefono || null,
    direccion || null,
    ciudad || null
  )

  return NextResponse.json<ApiResponse>({ data: cliente }, { status: 201 })
}
