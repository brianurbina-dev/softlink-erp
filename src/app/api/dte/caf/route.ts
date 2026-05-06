import { NextRequest, NextResponse } from "next/server"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { listarCafs, guardarCaf, eliminarCaf, parseCafXml } from "@/services/dte/cafService"
import type { ApiResponse } from "@/types"

/** GET /api/dte/caf — lista los CAFs de la empresa activa */
export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  const cafs = await listarCafs(ctx.schemaName)
  return NextResponse.json<ApiResponse>({ data: cafs })
}

/** POST /api/dte/caf — sube un CAF XML (multipart o JSON con campo xml) */
export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  let xmlContenido: string

  const contentType = req.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("caf") as File | null
    if (!file) {
      return NextResponse.json<ApiResponse>({ error: "Falta el archivo CAF (campo 'caf')" }, { status: 400 })
    }
    xmlContenido = await file.text()
  } else {
    const body = await req.json() as { xml?: string }
    if (!body.xml) {
      return NextResponse.json<ApiResponse>({ error: "Falta el campo 'xml'" }, { status: 400 })
    }
    xmlContenido = body.xml
  }

  // Validar que el XML tiene la estructura básica de un CAF
  try {
    parseCafXml(xmlContenido)
  } catch {
    return NextResponse.json<ApiResponse>(
      { error: "El XML no es un CAF válido (faltan campos TD, D o H)" },
      { status: 400 }
    )
  }

  const caf = await guardarCaf(ctx.schemaName, xmlContenido)
  return NextResponse.json<ApiResponse>({ data: caf }, { status: 201 })
}

/** DELETE /api/dte/caf?id=xxx — elimina un CAF */
export async function DELETE(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })
  if (!ctx.esAdmin) return NextResponse.json<ApiResponse>({ error: "Sin permisos" }, { status: 403 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json<ApiResponse>({ error: "Falta parámetro id" }, { status: 400 })

  await eliminarCaf(ctx.schemaName, id)
  return NextResponse.json<ApiResponse>({ data: { eliminado: true } })
}
