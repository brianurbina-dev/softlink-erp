/** IVA estándar Chile — no hardcodear 0.19 en componentes, importar esta constante. */
export const IVA_CHILE = 0.19

/** Tipos de documentos DTE soportados. */
export const TIPOS_DTE = {
  FACTURA_AFECTA: 33,
  FACTURA_EXENTA: 34,
  BOLETA_AFECTA: 39,
  NOTA_DEBITO: 56,
  GUIA_DESPACHO: 52,
  NOTA_CREDITO: 61,
} as const

export type TipoDTE = (typeof TIPOS_DTE)[keyof typeof TIPOS_DTE]

/** Calcula IVA sobre un monto neto (en CLP entero). */
export function calcularIva(montoNeto: number): number {
  return Math.round(montoNeto * IVA_CHILE)
}

/** Calcula total bruto a partir de monto neto. */
export function calcularTotal(montoNeto: number): number {
  return montoNeto + calcularIva(montoNeto)
}
