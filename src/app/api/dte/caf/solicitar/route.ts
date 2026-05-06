import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { solicitarCaf } from "@/services/dte/cafService"
import type { ApiResponse } from "@/types"

/**
 * POST /api/dte/caf/solicitar
 * Body: { tipoDte: number }
 * Solicita 100 folios al SII vía SimpleAPI y guarda el CAF resultante.
 */
export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  const body = await req.json() as { tipoDte?: number }
  const tipoDte = body.tipoDte

  if (!tipoDte || ![33, 34, 39, 52, 56, 61].includes(tipoDte)) {
    return NextResponse.json<ApiResponse>(
      { error: "tipoDte inválido. Valores permitidos: 33, 34, 39, 52, 56, 61" },
      { status: 400 }
    )
  }

  const [config, empresa] = await Promise.all([
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
  ])

  if (!config?.apiKey) {
    return NextResponse.json<ApiResponse>({ error: "No hay API key DTE configurado" }, { status: 400 })
  }
  if (!config.certificado || !config.certificadoPassword) {
    return NextResponse.json<ApiResponse>({ error: "No hay certificado digital configurado" }, { status: 400 })
  }
  if (!empresa) {
    return NextResponse.json<ApiResponse>({ error: "Empresa no encontrada" }, { status: 400 })
  }

  try {
    const caf = await solicitarCaf(ctx.schemaName, tipoDte, {
      apiKey: config.apiKey,
      rutEmpresa: empresa.rut,
      rutCertificado: config.rutCertificado ?? empresa.rut,
      certPassword: config.certificadoPassword,
      certBase64: config.certificado,
      ambiente: config.ambiente === "produccion" ? 1 : 0,
    })
    return NextResponse.json<ApiResponse>({ data: caf }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al solicitar CAF"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 502 })
  }
}
