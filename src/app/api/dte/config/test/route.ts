import { NextResponse } from "next/server"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { prisma } from "@/lib/db/prisma"
import { SimpleAPIAdapter } from "@/services/dte/adapters/SimpleAPIAdapter"
import type { ApiResponse } from "@/types"

export async function POST() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const [config, empresa] = await Promise.all([
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
  ])

  if (!config?.apiKey) {
    return NextResponse.json<ApiResponse>(
      { error: "Configura un API key antes de probar la conexión" },
      { status: 400 }
    )
  }

  const adapter = new SimpleAPIAdapter({
    apiKey: config.apiKey,
    ambiente: config.ambiente as "certificacion" | "produccion",
    rutEmpresa: empresa?.rut ?? "",
    razonSocial: empresa?.razonSocial ?? "",
    certPassword: config.certificadoPassword ?? null,
    certBase64: config.certificado ?? null,
  })

  const result = await adapter.testConexion()

  if (!result.ok) {
    return NextResponse.json<ApiResponse>({ error: result.error.message }, { status: 502 })
  }

  return NextResponse.json<ApiResponse>({ data: result.data })
}
