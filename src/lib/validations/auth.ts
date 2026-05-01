import { z } from "zod"
import { validarRut } from "@/lib/chile/rut"

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

export const registroSchema = z.object({
  nombre: z.string().min(2, "Ingresa tu nombre completo"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  rutEmpresa: z.string().refine(validarRut, "RUT de empresa inválido"),
  razonSocial: z.string().min(2, "Ingresa la razón social"),
  giro: z.string().min(2, "Ingresa el giro del negocio"),
  plan: z.enum(["starter", "pyme", "pro"]).default("starter"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegistroInput = z.infer<typeof registroSchema>
