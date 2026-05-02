import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { z } from "zod"
import type { ApiResponse } from "@/types"

const perfilSchema = z.object({
  razonSocial:   z.string().min(1).max(200),
  giro:          z.string().max(200).optional().nullable(),
  logoUrl:       z.string().max(500).optional().nullable(),
  telefono:      z.string().max(50).optional().nullable(),
  emailContacto: z.string().max(200).optional().nullable(),
  web:           z.string().max(300).optional().nullable(),
  direccion:     z.string().max(300).optional().nullable(),
  ciudad:        z.string().max(100).optional().nullable(),
})

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const empresa = await prisma.empresa.findUnique({ where: { id: ctx.empresaId } })
  if (!empresa) return NextResponse.json<ApiResponse>({ error: "Empresa no encontrada" }, { status: 404 })

  return NextResponse.json<ApiResponse>({ data: empresa })
}

export async function PUT(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const body = await req.json()
  const parsed = perfilSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })

  const empresa = await prisma.empresa.update({
    where: { id: ctx.empresaId },
    data: {
      razonSocial:   parsed.data.razonSocial,
      giro:          parsed.data.giro          ?? null,
      logoUrl:       parsed.data.logoUrl        || null,
      telefono:      parsed.data.telefono       ?? null,
      emailContacto: parsed.data.emailContacto  ?? null,
      web:           parsed.data.web            || null,
      direccion:     parsed.data.direccion      ?? null,
      ciudad:        parsed.data.ciudad         ?? null,
    },
  })

  return NextResponse.json<ApiResponse>({ data: empresa })
}
