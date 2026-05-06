import { z } from "zod"

const guiaItemSchema = z.object({
  productoId: z.string().nullable().optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  cantidad: z.number().int().min(1),
  precioUnitario: z.number().int().min(0),
  descuento: z.number().int().min(0).max(100).default(0),
})

export const guiaSchema = z.object({
  tipoTraslado: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  clienteId: z.string().nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  direccionDestino: z.string().max(200).nullable().optional(),
  transportistaRut: z.string().max(12).nullable().optional(),
  transportistaNombre: z.string().max(100).nullable().optional(),
  patente: z.string().max(20).nullable().optional(),
  items: z.array(guiaItemSchema).min(1, "Agrega al menos un ítem"),
  refFacturaId: z.string().nullable().optional(),
})

export type GuiaInput = z.infer<typeof guiaSchema>
