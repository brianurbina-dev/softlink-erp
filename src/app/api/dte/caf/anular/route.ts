import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { anularFolios } from "@/services/dte/cafService"
import type { ApiResponse } from "@/types"

/**
 * POST /api/dte/caf/anular
 * Body: { tipoDte: number, folioDesde: number, folioHasta: number }
 * Anula un rango de folios en el SII vía SimpleAPI.
 */
export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  const body = await req.json() as { tipoDte?: number; folioDesde?: number; folioHasta?: number }
  const { tipoDte, folioDesde, folioHasta } = body

  if (!tipoDte || !folioDesde || !folioHasta) {
    return NextResponse.json<ApiResponse>(
      { error: "Se requieren tipoDte, folioDesde y folioHasta" },
      { status: 400 }
    )
  }
  if (folioDesde > folioHasta) {
    return NextResponse.json<ApiResponse>(
      { error: "folioDesde debe ser menor o igual a folioHasta" },
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
    await anularFolios(tipoDte, folioDesde, folioHasta, {
      apiKey: config.apiKey,
      rutEmpresa: empresa.rut,
      rutCertificado: config.rutCertificado ?? empresa.rut,
      certPassword: config.certificadoPassword,
      certBase64: config.certificado,
      ambiente: config.ambiente === "produccion" ? 1 : 0,
    })

    return NextResponse.json<ApiResponse>({
      data: {
        mensaje: `Folios ${folioDesde}–${folioHasta} tipo ${tipoDte} anulados correctamente`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al anular folios"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 502 })
  }
}
