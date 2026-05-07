import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { uploadToR2, getSignedDownloadUrl, buildLogoKey } from "@/services/storage/r2Service"
import type { ApiResponse } from "@/types"

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}
const MAX_SIZE = 2 * 1024 * 1024

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const empresa = await prisma.empresa.findUnique({ where: { id: ctx.empresaId } })
  if (!empresa?.logoUrl) {
    return NextResponse.json<ApiResponse>({ error: "Sin logo" }, { status: 404 })
  }

  const url = await getSignedDownloadUrl(empresa.logoUrl, 3600)
  if (!url) return NextResponse.json<ApiResponse>({ error: "Error al obtener logo" }, { status: 500 })

  return NextResponse.redirect(url)
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json<ApiResponse>({ error: "No se recibió archivo" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json<ApiResponse>(
      { error: "Formato no permitido. Usa JPG, PNG, WEBP o SVG" },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json<ApiResponse>(
      { error: "El archivo supera el límite de 2 MB" },
      { status: 400 }
    )
  }

  const key = buildLogoKey(ctx.empresaId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  const ok = await uploadToR2(key, buffer, file.type)
  if (!ok) {
    return NextResponse.json<ApiResponse>(
      { error: "Error al subir imagen. Verifica la configuración de R2" },
      { status: 500 }
    )
  }

  await prisma.empresa.update({
    where: { id: ctx.empresaId },
    data: { logoUrl: key },
  })

  return NextResponse.json<ApiResponse>({ data: { key } })
}

export async function DELETE() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (ctx.rol !== "admin") return NextResponse.json<ApiResponse>({ error: "Sin permiso" }, { status: 403 })

  await prisma.empresa.update({
    where: { id: ctx.empresaId },
    data: { logoUrl: null },
  })

  return NextResponse.json<ApiResponse>({ data: { ok: true } })
}
