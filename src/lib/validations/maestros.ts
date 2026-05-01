import { z } from "zod"
import { validarRut, formatRutStorage } from "@/lib/chile/rut"

const rutField = z
  .string()
  .min(1, "RUT requerido")
  .refine((v) => validarRut(v), "RUT inválido")
  .transform((v) => formatRutStorage(v))

const contactFields = {
  giro: z.string().max(200).optional().default(""),
  email: z.string().max(200).optional().default(""),
  telefono: z.string().max(20).optional().default(""),
  direccion: z.string().max(300).optional().default(""),
  ciudad: z.string().max(100).optional().default(""),
}

export const clienteSchema = z.object({
  rut: rutField,
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  ...contactFields,
})

export const proveedorSchema = z.object({
  rut: rutField,
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  ...contactFields,
})

export const productoSchema = z.object({
  codigo: z.string().min(1, "Código requerido").max(50),
  nombre: z.string().min(1, "Nombre requerido").max(200),
  descripcion: z.string().max(500).optional().default(""),
  precio: z.number().int().min(0, "Precio debe ser mayor o igual a 0"),
  costo: z.number().int().min(0, "Costo debe ser mayor o igual a 0").optional().default(0),
  unidad: z.string().max(20).optional().default("UN"),
  afectoIva: z.boolean().optional().default(true),
  stockMinimo: z.number().int().min(0).optional().default(0),
})

export const bodegaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  descripcion: z.string().max(300).optional().default(""),
})

export const movimientoSchema = z.object({
  tipo: z.enum(["entrada", "salida", "ajuste"], { message: "Tipo inválido" }),
  productoId: z.string().min(1, "Producto requerido"),
  bodegaId: z.string().min(1, "Bodega requerida"),
  cantidad: z.number().int().min(1, "Cantidad debe ser al menos 1"),
  costoUnitario: z.number().int().min(0).optional().default(0),
  notas: z.string().max(300).optional().default(""),
})

export type ClienteInput = z.input<typeof clienteSchema>
export type ProveedorInput = z.input<typeof proveedorSchema>
export type ProductoInput = z.input<typeof productoSchema>
export type BodegaInput = z.input<typeof bodegaSchema>
export type MovimientoInput = z.input<typeof movimientoSchema>
