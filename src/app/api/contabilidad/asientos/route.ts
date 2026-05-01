import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { asientoSchema } from "@/lib/validations/contabilidad"
import type { ApiResponse } from "@/types"

export interface AsientoRow {
  id: string
  fecha: string
  descripcion: string
  referencia_tipo: string | null
  referencia_id: string | null
  automatico: boolean
  creado_en: string
  total_debe: number
  total_haber: number
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde") ?? "2000-01-01"
  const hasta = searchParams.get("hasta") ?? "2099-12-31"

  const asientos = await prisma.$queryRawUnsafe<AsientoRow[]>(
    `SELECT a.*,
            COALESCE(SUM(al.debe), 0)::int  AS total_debe,
            COALESCE(SUM(al.haber), 0)::int AS total_haber
     FROM "${ctx.schemaName}".asientos a
     LEFT JOIN "${ctx.schemaName}".asiento_lineas al ON al.asiento_id = a.id
     WHERE a.fecha BETWEEN $1 AND $2
     GROUP BY a.id
     ORDER BY a.fecha DESC, a.creado_en DESC
     LIMIT 500`,
    desde,
    hasta
  )

  return NextResponse.json<ApiResponse>({ data: asientos })
}

export async function POST(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = asientoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { fecha, descripcion, lineas } = parsed.data

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0)
  if (totalDebe !== totalHaber) {
    return NextResponse.json<ApiResponse>(
      { error: `El asiento no cuadra: debe=${totalDebe} haber=${totalHaber}` },
      { status: 400 }
    )
  }
  if (totalDebe === 0) {
    return NextResponse.json<ApiResponse>({ error: "El asiento no puede ser por $0" }, { status: 400 })
  }

  const [asiento] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${ctx.schemaName}".asientos (fecha, descripcion, automatico)
     VALUES ($1, $2, false)
     RETURNING id`,
    fecha,
    descripcion
  )

  for (const linea of lineas) {
    if (linea.debe === 0 && linea.haber === 0) continue
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${ctx.schemaName}".asiento_lineas (asiento_id, cuenta_id, debe, haber)
       VALUES ($1, $2, $3, $4)`,
      asiento.id,
      linea.cuentaId,
      linea.debe,
      linea.haber
    )
  }

  return NextResponse.json<ApiResponse>({ data: { id: asiento.id } }, { status: 201 })
}
