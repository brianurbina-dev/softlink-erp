import { z } from "zod"

const itemSchema = z.object({
  productoId: z.string().nullable().optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  cantidad: z.number().int().min(1, "Cantidad mínima es 1"),
  precioUnitario: z.number().int().min(0, "Precio inválido"),
  descuento: z.number().int().min(0).max(100).default(0),
})

export const facturaSchema = z.object({
  tipo: z.union([z.literal(33), z.literal(34)]),
  clienteId: z.string().min(1, "Selecciona un cliente"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
})

export type FacturaInput = z.infer<typeof facturaSchema>
export type ItemInput = z.infer<typeof itemSchema>
