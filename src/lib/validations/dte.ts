import { z } from "zod"

export const dteConfigSchema = z.object({
  proveedor: z.enum(["simpleapi", "yamt"]).default("simpleapi"),
  apiKey: z.string().max(500).optional().default(""),
  ambiente: z.enum(["certificacion", "produccion"]).default("certificacion"),
  certificado: z.string().optional(),
  certificadoNombre: z.string().max(200).optional(),
  certificadoPassword: z.string().max(200).optional().default(""),
})

export type DteConfigInput = z.input<typeof dteConfigSchema>
