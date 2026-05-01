import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

type ReglaDef = {
  evento: string
  codigo: string
  tipo: "debe" | "haber"
  campo_monto: "neto" | "iva" | "total"
  orden: number
}

const REGLAS_POR_DEFECTO: ReglaDef[] = [
  // Factura emitida (tipo 33/34)
  { evento: "factura_emitida", codigo: "1.1.03", tipo: "debe",  campo_monto: "total", orden: 1 },
  { evento: "factura_emitida", codigo: "4.1.01", tipo: "haber", campo_monto: "neto",  orden: 2 },
  { evento: "factura_emitida", codigo: "2.1.03", tipo: "haber", campo_monto: "iva",   orden: 3 },
  // Boleta emitida (tipo 39)
  { evento: "boleta_emitida",  codigo: "1.1.01", tipo: "debe",  campo_monto: "total", orden: 1 },
  { evento: "boleta_emitida",  codigo: "4.1.01", tipo: "haber", campo_monto: "neto",  orden: 2 },
  { evento: "boleta_emitida",  codigo: "2.1.03", tipo: "haber", campo_monto: "iva",   orden: 3 },
  // Compra recibida
  { evento: "compra_recibida", codigo: "1.1.06", tipo: "debe",  campo_monto: "neto",  orden: 1 },
  { evento: "compra_recibida", codigo: "1.1.05", tipo: "debe",  campo_monto: "iva",   orden: 2 },
  { evento: "compra_recibida", codigo: "2.1.01", tipo: "haber", campo_monto: "total", orden: 3 },
  // Nota de crédito emitida
  { evento: "nota_credito_emitida", codigo: "4.1.01", tipo: "debe",  campo_monto: "neto",  orden: 1 },
  { evento: "nota_credito_emitida", codigo: "2.1.03", tipo: "debe",  campo_monto: "iva",   orden: 2 },
  { evento: "nota_credito_emitida", codigo: "1.1.03", tipo: "haber", campo_monto: "total", orden: 3 },
]

// Eventos que cubre el plan estándar — se borran y reinsertan completamente
const EVENTOS_ESTANDAR = [
  "factura_emitida",
  "boleta_emitida",
  "compra_recibida",
  "nota_credito_emitida",
]

export async function POST() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName

  // Eliminar TODAS las reglas de los 4 eventos estándar antes de reinsertar
  // (evita duplicados y garantiza el estado limpio para cada evento)
  const eliminadas = await prisma.$executeRawUnsafe(
    `DELETE FROM "${s}".reglas_contables WHERE evento = ANY($1::text[])`,
    EVENTOS_ESTANDAR
  )

  // Reinsertar solo las reglas cuya cuenta existe en el plan
  let insertadas = 0
  for (const r of REGLAS_POR_DEFECTO) {
    const [cuenta] = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${s}".plan_cuentas WHERE codigo = $1 AND activo = true LIMIT 1`,
      r.codigo
    )
    if (!cuenta) continue

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".reglas_contables (evento, cuenta_id, tipo, campo_monto, orden)
       VALUES ($1, $2, $3, $4, $5)`,
      r.evento, cuenta.id, r.tipo, r.campo_monto, r.orden
    )
    insertadas++
  }

  return NextResponse.json<ApiResponse>({ data: { eliminadas: Number(eliminadas), insertadas } }, { status: 201 })
}
