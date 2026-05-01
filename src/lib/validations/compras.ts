import { z } from "zod"

const itemCompraSchema = z.object({
  productoId: z.string().nullable().optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  cantidad: z.number().int().min(1, "Cantidad mínima es 1"),
  precioUnitario: z.number().int().min(0, "Precio inválido"),
})

export const compraSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona un proveedor"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  notas: z.string().max(500).optional().default(""),
  items: z.array(itemCompraSchema).min(1, "Agrega al menos un ítem"),
})

export const recibirCompraSchema = z.object({
  bodegaId: z.string().min(1, "Selecciona una bodega"),
})

export type CompraInput = z.infer<typeof compraSchema>
export type ItemCompraInput = z.infer<typeof itemCompraSchema>
