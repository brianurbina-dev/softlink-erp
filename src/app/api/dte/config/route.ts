import { NextRequest, NextResponse } from "next/server"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { prisma } from "@/lib/db/prisma"
import { dteConfigSchema } from "@/lib/validations/dte"
import type { ApiResponse } from "@/types"

/** GET — devuelve la config DTE de la empresa activa (sin exponer API key completa). */
export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const config = await prisma.dteConfig.findUnique({
    where: { empresaId: ctx.empresaId },
  })

  if (!config) return NextResponse.json<ApiResponse>({ data: null })

  return NextResponse.json<ApiResponse>({
    data: {
      proveedor: config.proveedor,
      ambiente: config.ambiente,
      apiKeyMasked: config.apiKey ? `${config.apiKey.slice(0, 6)}${"•".repeat(12)}` : null,
      apiKeyConfigurado: !!config.apiKey,
      certificadoNombre: config.certificadoNombre,
      certificadoConfigurado: !!config.certificado,
    },
  })
}

/** PUT — guarda la config DTE de la empresa activa. */
export async function PUT(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = dteConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { proveedor, apiKey, ambiente, certificado, certificadoNombre, certificadoPassword } =
    parsed.data

  const existing = await prisma.dteConfig.findUnique({
    where: { empresaId: ctx.empresaId },
  })

  const updateData: Record<string, string | null> = {
    proveedor,
    ambiente,
  }

  // Solo actualizar apiKey si se envió un valor nuevo (no está vacío)
  if (apiKey) updateData.apiKey = apiKey

  // Solo actualizar certificado si se envió uno nuevo
  if (certificado) {
    updateData.certificado = certificado
    updateData.certificadoNombre = certificadoNombre ?? null
  }

  // Solo actualizar password si se envió uno nuevo
  if (certificadoPassword) updateData.certificadoPassword = certificadoPassword

  let config
  if (existing) {
    config = await prisma.dteConfig.update({
      where: { empresaId: ctx.empresaId },
      data: updateData,
    })
  } else {
    config = await prisma.dteConfig.create({
      data: { ...updateData, empresaId: ctx.empresaId },
    })
  }

  return NextResponse.json<ApiResponse>({
    data: {
      proveedor: config.proveedor,
      ambiente: config.ambiente,
      apiKeyConfigurado: !!config.apiKey,
      certificadoConfigurado: !!config.certificado,
    },
  })
}
