import { z } from "zod"

export const dteConfigSchema = z.object({
  proveedor: z.enum(["simpleapi", "yamt"]).default("simpleapi"),
  apiKey: z.string().max(500).optional().default(""),
  ambiente: z.enum(["certificacion", "produccion"]).default("certificacion"),
  certificado: z.string().optional(),
  certificadoNombre: z.string().max(200).optional(),
  certificadoPassword: z.string().max(200).optional().default(""),
  rutEmpresa: z.string().max(20).optional().default(""),
  rutCertificado: z.string().max(20).optional().default(""),
  actividadesEconomicas: z.array(z.number().int().positive()).optional(),
})

export type DteConfigInput = z.input<typeof dteConfigSchema>
