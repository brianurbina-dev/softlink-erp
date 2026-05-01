import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { reglaSchema } from "@/lib/validations/contabilidad"
import type { ApiResponse } from "@/types"

export interface ReglaRow {
  id: string
  evento: string
  cuenta_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  tipo: string
  campo_monto: string
  orden: number
  activo: boolean
}

export async function GET() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const reglas = await prisma.$queryRawUnsafe<ReglaRow[]>(
    `SELECT rc.id, rc.evento, rc.cuenta_id, pc.codigo AS cuenta_codigo,
            pc.nombre AS cuenta_nombre, rc.tipo, rc.campo_monto, rc.orden, rc.activo
     FROM "${ctx.schemaName}".reglas_contables rc
     JOIN "${ctx.schemaName}".plan_cuentas pc ON pc.id = rc.cuenta_id
     ORDER BY rc.evento, rc.orden`
  )

  return NextResponse.json<ApiResponse>({ data: reglas })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = reglaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { evento, cuentaId, tipo, campo_monto, orden } = parsed.data

  const [regla] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".reglas_contables (evento, cuenta_id, tipo, campo_monto, orden)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    evento,
    cuentaId,
    tipo,
    campo_monto,
    orden
  )

  return NextResponse.json<ApiResponse>({ data: { id: regla.id } }, { status: 201 })
}
