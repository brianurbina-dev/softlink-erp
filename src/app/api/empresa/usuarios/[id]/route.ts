import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { z } from "zod"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  rol:      z.enum(["admin", "usuario"]).optional(),
  permisos: z.array(z.string()).optional(),
  activo:   z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })

  const eu = await prisma.empresaUsuario.findFirst({ where: { id, empresaId: ctx.empresaId } })
  if (!eu) return NextResponse.json<ApiResponse>({ error: "Usuario no encontrado" }, { status: 404 })

  if (eu.usuarioId === ctx.usuarioId && parsed.data.rol === "usuario") {
    return NextResponse.json<ApiResponse>({ error: "No puedes quitarte el rol de administrador" }, { status: 400 })
  }

  const updated = await prisma.empresaUsuario.update({
    where: { id },
    data: {
      ...(parsed.data.rol      !== undefined && { rol:      parsed.data.rol }),
      ...(parsed.data.permisos !== undefined && { permisos: parsed.data.permisos }),
      ...(parsed.data.activo   !== undefined && { activo:   parsed.data.activo }),
    },
    include: { usuario: true },
  })

  return NextResponse.json<ApiResponse>({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const { id } = await params

  const eu = await prisma.empresaUsuario.findFirst({ where: { id, empresaId: ctx.empresaId } })
  if (!eu) return NextResponse.json<ApiResponse>({ error: "Usuario no encontrado" }, { status: 404 })
  if (eu.usuarioId === ctx.usuarioId) return NextResponse.json<ApiResponse>({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })

  await prisma.empresaUsuario.delete({ where: { id } })
  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}
