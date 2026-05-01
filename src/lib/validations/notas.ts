import { z } from "zod"

const notaItemSchema = z.object({
  productoId: z.string().nullable().optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  cantidad: z.number().int().min(1),
  precioUnitario: z.number().int().min(0),
  descuento: z.number().int().min(0).max(100).default(0),
})

export const notaSchema = z.object({
  tipo: z.union([z.literal(56), z.literal(61)]),
  clienteId: z.string().min(1, "Selecciona un cliente"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  referenciaTipo: z.number().int(),
  referenciaFolio: z.number().int().positive(),
  referenciaRazon: z.string().min(1, "Ingresa la razón").max(200),
  items: z.array(notaItemSchema).min(1),
})

export type NotaInput = z.infer<typeof notaSchema>
