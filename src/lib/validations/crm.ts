import { z } from "zod"

export const ETAPAS_CRM = ["prospecto", "propuesta", "negociacion", "ganado", "perdido"] as const
export type EtapaCRM = (typeof ETAPAS_CRM)[number]

export const TIPOS_ACTIVIDAD = ["llamada", "reunion", "email", "tarea", "nota"] as const
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number]

export const oportunidadSchema = z.object({
  clienteId: z.string().nullable().optional(),
  titulo: z.string().min(1, "Título requerido").max(200),
  descripcion: z.string().max(500).optional().default(""),
  valorEstimado: z.number().int().min(0).optional().default(0),
  etapa: z.enum(ETAPAS_CRM).optional().default("prospecto"),
  fechaCierreEstimada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable().optional(),
})

export const actividadSchema = z.object({
  tipo: z.enum(TIPOS_ACTIVIDAD).default("nota"),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  completada: z.boolean().optional().default(false),
})

export type OportunidadInput = z.infer<typeof oportunidadSchema>
export type ActividadInput = z.infer<typeof actividadSchema>
