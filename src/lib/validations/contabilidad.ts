import { z } from "zod"

const TIPOS_CUENTA = ["activo", "pasivo", "patrimonio", "ingreso", "gasto"] as const
const EVENTOS = ["factura_emitida", "boleta_emitida", "compra_recibida", "nota_credito_emitida"] as const
const CAMPOS_MONTO = ["neto", "iva", "total"] as const

export const cuentaSchema = z.object({
  codigo: z
    .string()
    .min(1, "Código requerido")
    .max(20, "Código muy largo")
    .regex(/^[\d.]+$/, "Solo números y puntos (ej: 1.1.01)"),
  nombre: z.string().min(1, "Nombre requerido").max(150),
  tipo: z.enum(TIPOS_CUENTA, { error: "Tipo inválido" }),
  subtipo: z.string().max(100).optional().nullable(),
  cuentaPadreId: z.string().nullable().optional(),
  aceptaMovimientos: z.boolean().default(true),
})

export const asientoLineaSchema = z.object({
  cuentaId: z.string().min(1, "Cuenta requerida"),
  debe: z.number().int().min(0),
  haber: z.number().int().min(0),
})

export const asientoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  lineas: z
    .array(asientoLineaSchema)
    .min(2, "El asiento debe tener al menos 2 líneas"),
})

export const reglaSchema = z.object({
  evento: z.enum(EVENTOS, { error: "Evento inválido" }),
  cuentaId: z.string().min(1, "Cuenta requerida"),
  tipo: z.enum(["debe", "haber"], { error: "Tipo debe ser 'debe' o 'haber'" }),
  campo_monto: z.enum(CAMPOS_MONTO, { error: "Campo de monto inválido" }),
  orden: z.number().int().min(0).default(0),
})

export type CuentaInput = z.infer<typeof cuentaSchema>
export type AsientoInput = z.infer<typeof asientoSchema>
export type ReglaInput = z.infer<typeof reglaSchema>
export type TipoCuenta = (typeof TIPOS_CUENTA)[number]
export type EventoContable = (typeof EVENTOS)[number]
export const EVENTOS_CONTABLES = EVENTOS
export const CAMPOS_MONTO_VALIDOS = CAMPOS_MONTO
