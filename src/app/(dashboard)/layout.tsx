import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { DashboardShell } from "@/components/erp/DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user.id },
    include: {
      empresas: {
        include: { empresa: true },
        orderBy: { empresa: { creadaEn: "asc" } },
      },
    },
  })

  if (!usuario || usuario.empresas.length === 0) redirect("/registro")

  const cookieStore = await cookies()
  const empresaIdCookie = cookieStore.get("sl_empresa_id")?.value

  const euActiva =
    usuario.empresas.find((eu) => eu.empresa.id === empresaIdCookie) ??
    usuario.empresas[0]

  const empresaActiva = euActiva.empresa
  const empresas = usuario.empresas.map((eu) => ({
    id: eu.empresa.id,
    razonSocial: eu.empresa.razonSocial,
  }))

  return (
    <DashboardShell
      usuario={{ nombre: usuario.nombre, rolGlobal: usuario.rolGlobal }}
      empresa={empresaActiva}
      empresas={empresas}
      empresaRol={euActiva.rol}
      permisos={euActiva.permisos}
    >
      {children}
    </DashboardShell>
  )
}
