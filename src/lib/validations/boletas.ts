import { z } from "zod"

const boletaItemSchema = z.object({
  productoId: z.string().nullable().optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  cantidad: z.number().int().min(1, "Cantidad mínima es 1"),
  precioUnitario: z.number().int().min(0, "Precio inválido"),
  descuento: z.number().int().min(0).max(100).default(0),
})

export const boletaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  receptorRut: z.string().max(12).optional().nullable(),
  receptorNombre: z.string().max(100).optional().nullable(),
  items: z.array(boletaItemSchema).min(1, "Agrega al menos un ítem"),
})

export type BoletaInput = z.infer<typeof boletaSchema>
export type BoletaItemInput = z.infer<typeof boletaItemSchema>
