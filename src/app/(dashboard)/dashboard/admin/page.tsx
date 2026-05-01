import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const usuario = await prisma.usuario.findUnique({ where: { authUserId: user.id } })
  if (usuario?.rolGlobal !== "super_admin") redirect("/dashboard")

  const empresas = await prisma.empresa.findMany({
    include: { _count: { select: { usuarios: true } } },
    orderBy: { creadaEn: "desc" },
  })

  const planLabel: Record<string, string> = {
    starter: "Starter",
    pyme: "PyME",
    pro: "Pro",
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-sl-text">Panel de administración</h1>
        <p className="mt-0.5 text-sm text-sl-muted">
          Vista global del sistema · {empresas.length} empresa{empresas.length !== 1 ? "s" : ""}{" "}
          registradas
        </p>
      </div>

      <div className="rounded-card border border-sl-border bg-sl-bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                Empresa
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                RUT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                Plan
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                Usuarios
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sl-muted">
                Creada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sl-border/60">
            {empresas.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-sl-border/20">
                <td className="px-4 py-3 font-medium text-sl-text">{e.razonSocial}</td>
                <td className="px-4 py-3 text-sl-muted font-mono text-xs">{e.rut}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sl-purple/15 px-2 py-0.5 text-xs font-medium text-sl-purple-light">
                    {planLabel[e.plan] ?? e.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-sl-muted">{e._count.usuarios}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.activa
                        ? "bg-sl-success/15 text-sl-success"
                        : "bg-sl-danger/15 text-sl-danger"
                    }`}
                  >
                    {e.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-sl-muted">
                  {new Date(e.creadaEn).toLocaleDateString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {empresas.length === 0 && (
          <div className="py-12 text-center text-sl-muted">No hay empresas registradas aún.</div>
        )}
      </div>
    </div>
  )
}
