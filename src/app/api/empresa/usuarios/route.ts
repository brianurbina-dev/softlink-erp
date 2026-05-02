import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"
import type { ApiResponse } from "@/types"

const crearSchema = z.object({
  email:    z.string().email(),
  nombre:   z.string().min(2).max(100),
  password: z.string().min(6).max(100).optional(),
  rol:      z.enum(["admin", "usuario"]),
  permisos: z.array(z.string()).default([]),
})

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const rows = await prisma.empresaUsuario.findMany({
    where: { empresaId: ctx.empresaId },
    include: { usuario: true },
    orderBy: { usuario: { creadoEn: "asc" } },
  })

  return NextResponse.json<ApiResponse>({ data: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const body = await req.json()
  const parsed = crearSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })

  const { email, nombre, password, rol, permisos } = parsed.data

  const yaEnEmpresa = await prisma.empresaUsuario.findFirst({
    where: { empresaId: ctx.empresaId, usuario: { email } },
  })
  if (yaEnEmpresa) return NextResponse.json<ApiResponse>({ error: "El usuario ya pertenece a esta empresa" }, { status: 409 })

  let usuarioRecord = await prisma.usuario.findUnique({ where: { email } })

  if (!usuarioRecord) {
    if (!password) return NextResponse.json<ApiResponse>({ error: "La contraseña es requerida para usuarios nuevos" }, { status: 400 })

    const supabaseAdmin = createAdminClient()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) return NextResponse.json<ApiResponse>({ error: authError.message }, { status: 400 })

    usuarioRecord = await prisma.usuario.create({
      data: { authUserId: authData.user.id, email, nombre, rolGlobal: "user" },
    })
  }

  const eu = await prisma.empresaUsuario.create({
    data: { empresaId: ctx.empresaId, usuarioId: usuarioRecord.id, rol, permisos, activo: true },
    include: { usuario: true },
  })

  return NextResponse.json<ApiResponse>({ data: eu }, { status: 201 })
}
