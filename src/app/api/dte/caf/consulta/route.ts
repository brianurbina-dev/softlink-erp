import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

const SIMPLEAPI_SERVICIOS_URL = "https://servicios.simpleapi.cl"

/**
 * POST /api/dte/caf/consulta
 * Body: { tipoDte: number, desde: string }  (desde en formato DD-MM-YYYY)
 * Consulta el estado de folios en el SII desde una fecha dada.
 */
export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json() as { tipoDte?: number; desde?: string }
  const tipoDte = body.tipoDte ?? 33
  const desde = body.desde ?? "01-01-2024"

  const [config, empresa] = await Promise.all([
    prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
    prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
  ])

  if (!config?.apiKey || !config.certificado || !config.certificadoPassword || !empresa) {
    return NextResponse.json<ApiResponse>({ error: "Configuración DTE incompleta" }, { status: 400 })
  }

  const certBuffer = Buffer.from(config.certificado, "base64")
  const input = {
    RutCertificado: config.rutCertificado ?? empresa.rut,
    Password: config.certificadoPassword,
    RutEmpresa: empresa.rut,
    Ambiente: config.ambiente === "produccion" ? 1 : 0,
  }

  const form = new FormData()
  form.append("input", JSON.stringify(input))
  form.append(
    "files",
    new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
    "certificado.pfx"
  )

  const url = `${SIMPLEAPI_SERVICIOS_URL}/api/folios/consulta/${tipoDte}/${desde}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: config.apiKey },
      body: form,
      signal: AbortSignal.timeout(300_000),
    })
    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json<ApiResponse>({ error: `SII error: ${text.slice(0, 300)}` }, { status: 502 })
    }

    const data = JSON.parse(text)
    return NextResponse.json<ApiResponse>({ data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de conexión"
    return NextResponse.json<ApiResponse>({ error: msg }, { status: 502 })
  }
}
