import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import type { ApiResponse } from "@/types"

/** GET — devuelve las empresas del usuario autenticado */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user.id },
    include: {
      empresas: {
        include: { empresa: true },
      },
    },
  })

  if (!usuario) {
    return NextResponse.json<ApiResponse>({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const empresas = usuario.empresas.map((eu) => ({
    id: eu.empresa.id,
    rut: eu.empresa.rut,
    razonSocial: eu.empresa.razonSocial,
    plan: eu.empresa.plan,
    rol: eu.rol,
  }))

  return NextResponse.json<ApiResponse>({ data: empresas })
}

/** PUT — cambia la empresa activa del usuario */
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  }

  const { empresaId } = await req.json()
  if (!empresaId) {
    return NextResponse.json<ApiResponse>({ error: "empresaId requerido" }, { status: 400 })
  }

  // Verificar que el usuario pertenece a esa empresa
  const usuario = await prisma.usuario.findUnique({ where: { authUserId: user.id } })
  if (!usuario) {
    return NextResponse.json<ApiResponse>({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const pertenece = await prisma.empresaUsuario.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId: usuario.id } },
  })

  if (!pertenece) {
    return NextResponse.json<ApiResponse>({ error: "Sin acceso a esta empresa" }, { status: 403 })
  }

  const response = NextResponse.json<ApiResponse>({ data: { empresaId } })
  response.cookies.set("sl_empresa_id", empresaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}
