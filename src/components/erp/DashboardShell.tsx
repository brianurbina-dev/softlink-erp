"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sl_sidebar_open"

interface Props {
  usuario: { nombre: string; rolGlobal: string }
  empresa: { id: string; razonSocial: string; schemaName?: string }
  empresas: { id: string; razonSocial: string }[]
  empresaRol: string
  permisos: string[]
  children: React.ReactNode
}

export function DashboardShell({ usuario, empresa, empresas, empresaRol, permisos, children }: Props) {
  const [open, setOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) setOpen(saved === "true")
    setMounted(true)
  }, [])

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-sl-bg-dark text-sl-text">
      <Sidebar usuario={usuario} empresaRol={empresaRol} permisos={permisos} open={!mounted || open} onToggle={toggle} />

      {/* Contenido principal */}
      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col transition-all duration-300",
          mounted && !open ? "pl-0" : "pl-[220px]"
        )}
      >
        <Topbar
          empresa={empresa}
          empresas={empresas}
          sidebarOpen={!mounted || open}
          onToggleSidebar={toggle}
        />
        <main className="flex-1 pt-14">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
