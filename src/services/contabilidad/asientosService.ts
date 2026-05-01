import { prisma } from "@/lib/db/prisma"

interface ReglaRow {
  cuenta_id: string
  tipo: "debe" | "haber"
  campo_monto: "neto" | "iva" | "total"
  orden: number
}

interface Montos {
  neto: number
  iva: number
  total: number
}

/**
 * Crea un asiento contable automático basado en las reglas configuradas para el evento.
 * Si no hay reglas configuradas o el asiento no cuadra, finaliza silenciosamente.
 */
export async function crearAsientoAutomatico(
  schemaName: string,
  evento: string,
  montos: Montos,
  descripcion: string,
  referenciaTipo: string,
  referenciaId: string
): Promise<void> {
  const reglas = await prisma.$queryRawUnsafe<ReglaRow[]>(
    `SELECT rc.cuenta_id, rc.tipo, rc.campo_monto
     FROM "${schemaName}".reglas_contables rc
     JOIN "${schemaName}".plan_cuentas pc ON pc.id = rc.cuenta_id
     WHERE rc.evento = $1 AND rc.activo = true AND pc.activo = true
     ORDER BY rc.orden`,
    evento
  )

  if (reglas.length === 0) return

  const lineas = reglas
    .map((r) => ({
      cuenta_id: r.cuenta_id,
      debe: r.tipo === "debe" ? montos[r.campo_monto] : 0,
      haber: r.tipo === "haber" ? montos[r.campo_monto] : 0,
    }))
    .filter((l) => l.debe > 0 || l.haber > 0)

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0)

  if (totalDebe !== totalHaber || lineas.length < 2) return

  const [asiento] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "${schemaName}".asientos (fecha, descripcion, referencia_tipo, referencia_id, automatico)
     VALUES (CURRENT_DATE, $1, $2, $3, true)
     RETURNING id`,
    descripcion,
    referenciaTipo,
    referenciaId
  )

  for (const linea of lineas) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".asiento_lineas (asiento_id, cuenta_id, debe, haber)
       VALUES ($1, $2, $3, $4)`,
      asiento.id,
      linea.cuenta_id,
      linea.debe,
      linea.haber
    )
  }
}
