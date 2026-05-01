"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Bell, Search, Sun, Moon, PanelLeftOpen } from "lucide-react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface TopbarProps {
  empresa: { id: string; razonSocial: string }
  empresas: { id: string; razonSocial: string }[]
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Topbar({ empresa, empresas, sidebarOpen, onToggleSidebar }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const router = useRouter()

  async function cambiarEmpresa(empresaId: string) {
    await fetch("/api/auth/empresa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId }),
    })
    setSelectorOpen(false)
    router.refresh()
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-10 flex h-topbar items-center justify-between border-b border-sl-border bg-sl-bg-card px-4 transition-[left] duration-300",
        sidebarOpen ? "left-[220px]" : "left-0"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Botón para abrir sidebar cuando está oculto */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            title="Mostrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sl-muted transition-colors hover:bg-sl-border/50 hover:text-sl-text"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Selector de empresa activa */}
        <div className="relative">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-sl-border/50"
          >
            <span className="h-2 w-2 rounded-full bg-sl-success" />
            <span className="font-medium text-sl-text">{empresa.razonSocial}</span>
            {empresas.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-sl-muted" />}
          </button>

          {selectorOpen && empresas.length > 1 && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-sl-border bg-sl-bg-card p-1 shadow-lg">
              {empresas.map((e) => (
                <button
                  key={e.id}
                  onClick={() => cambiarEmpresa(e.id)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sl-text transition-colors hover:bg-sl-purple/[0.12]"
                >
                  {e.id === empresa.id && <span className="h-1.5 w-1.5 rounded-full bg-sl-purple" />}
                  {e.razonSocial}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Acciones derechas */}
      <div className="flex items-center gap-1">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-sl-muted transition-colors hover:bg-sl-border/50 hover:text-sl-text">
          <Search className="h-4 w-4" />
        </button>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-sl-muted transition-colors hover:bg-sl-border/50 hover:text-sl-text">
          <Bell className="h-4 w-4" />
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sl-muted transition-colors hover:bg-sl-border/50 hover:text-sl-text"
          title="Cambiar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={handleLogout}
          className="ml-2 rounded-lg px-3 py-1.5 text-xs text-sl-muted transition-colors hover:bg-sl-border/50 hover:text-sl-danger"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
