import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"

export type EmpresaContext = {
  usuarioId: string
  empresaId: string
  schemaName: string
  rol: string
  permisos: string[]
  esAdmin: boolean
}

/** Obtiene el contexto de empresa del usuario autenticado para usar en API routes. */
export async function getEmpresaContext(): Promise<EmpresaContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const empresaIdCookie = cookieStore.get("sl_empresa_id")?.value

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user.id },
    include: {
      empresas: {
        include: { empresa: true },
        orderBy: { empresa: { creadaEn: "asc" } },
      },
    },
  })

  if (!usuario || usuario.empresas.length === 0) return null

  const eu = empresaIdCookie
    ? (usuario.empresas.find((e) => e.empresa.id === empresaIdCookie) ?? usuario.empresas[0])
    : usuario.empresas[0]

  return {
    usuarioId: usuario.id,
    empresaId: eu.empresa.id,
    schemaName: eu.empresa.schemaName,
    rol: eu.rol,
    permisos: eu.permisos,
    esAdmin: eu.rol === "admin",
  }
}
