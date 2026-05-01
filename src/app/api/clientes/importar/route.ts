import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { clienteSchema } from "@/lib/validations/maestros"
import type { ApiResponse } from "@/types"

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  if (!Array.isArray(body)) {
    return NextResponse.json<ApiResponse>({ error: "Se esperaba un array de registros" }, { status: 400 })
  }

  let importados = 0
  const errores: { fila: number; error: string }[] = []

  for (let i = 0; i < body.length; i++) {
    const parsed = clienteSchema.safeParse(body[i])
    if (!parsed.success) {
      errores.push({ fila: i + 1, error: parsed.error.issues[0].message })
      continue
    }

    const { rut, razonSocial, giro, email, telefono, direccion, ciudad } = parsed.data

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${ctx.schemaName}".clientes (rut, razon_social, giro, email, telefono, direccion, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (rut) DO UPDATE SET
           razon_social = EXCLUDED.razon_social,
           giro = EXCLUDED.giro,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono,
           direccion = EXCLUDED.direccion,
           ciudad = EXCLUDED.ciudad`,
        rut,
        razonSocial,
        giro || null,
        email || null,
        telefono || null,
        direccion || null,
        ciudad || null
      )
      importados++
    } catch {
      errores.push({ fila: i + 1, error: "Error al importar este registro" })
    }
  }

  return NextResponse.json<ApiResponse>({
    data: { importados, errores },
    meta: { total: body.length },
  })
}
