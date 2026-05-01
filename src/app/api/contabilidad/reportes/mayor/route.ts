import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface MovimientoMayor {
  asiento_id: string
  fecha: string
  descripcion: string
  automatico: boolean
  debe: number
  haber: number
}

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cuentaId = searchParams.get("cuentaId")
  const desde = searchParams.get("desde") ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const hasta = searchParams.get("hasta") ?? new Date().toISOString().slice(0, 10)

  if (!cuentaId) {
    return NextResponse.json<ApiResponse>({ error: "Parámetro cuentaId requerido" }, { status: 400 })
  }

  const movimientos = await prisma.$queryRawUnsafe<MovimientoMayor[]>(
    `SELECT
       a.id AS asiento_id,
       a.fecha::text,
       a.descripcion,
       a.automatico,
       al.debe::int,
       al.haber::int
     FROM "${ctx.schemaName}".asiento_lineas al
     JOIN "${ctx.schemaName}".asientos a ON a.id = al.asiento_id
     WHERE al.cuenta_id = $1
       AND a.fecha BETWEEN $2 AND $3
     ORDER BY a.fecha, a.creado_en`,
    cuentaId,
    desde,
    hasta
  )

  const saldoAcumulado = movimientos.reduce<(MovimientoMayor & { saldo: number })[]>((acc, m) => {
    const prev = acc[acc.length - 1]?.saldo ?? 0
    return [...acc, { ...m, saldo: prev + m.debe - m.haber }]
  }, [])

  const totalDebe = movimientos.reduce((s, m) => s + m.debe, 0)
  const totalHaber = movimientos.reduce((s, m) => s + m.haber, 0)

  return NextResponse.json<ApiResponse>({
    data: { movimientos: saldoAcumulado, totalDebe, totalHaber, desde, hasta },
  })
}
