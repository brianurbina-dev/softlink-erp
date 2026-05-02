"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Receipt, FileCheck, Package,
  ShoppingCart, Users, Settings, Shield, UserCheck, Truck,
  Box, ChevronDown, PanelLeftClose, FileMinus, Warehouse,
  Activity, BarChart2, TrendingUp, ClipboardList, BookOpen,
  BookMarked, Zap, Building2, UserCog,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { puedeVer } from "@/lib/permisos"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permiso?: string
}

interface NavSection {
  title: string
  items: NavItem[]
  defaultOpen?: boolean
}

const navSections: NavSection[] = [
  {
    title: "Principal",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Maestros",
    defaultOpen: true,
    items: [
      { label: "Clientes",    href: "/dashboard/maestros/clientes",    icon: UserCheck, permiso: "maestros" },
      { label: "Proveedores", href: "/dashboard/maestros/proveedores", icon: Truck,     permiso: "maestros" },
      { label: "Productos",   href: "/dashboard/maestros/productos",   icon: Box,       permiso: "maestros" },
    ],
  },
  {
    title: "Facturación",
    defaultOpen: true,
    items: [
      { label: "Facturas",          href: "/dashboard/facturacion/facturas",    icon: FileText,  permiso: "facturacion" },
      { label: "Boletas",           href: "/dashboard/facturacion/boletas",     icon: Receipt,   permiso: "facturacion" },
      { label: "Guías de despacho", href: "/dashboard/facturacion/guias",       icon: Truck,     permiso: "facturacion" },
      { label: "Notas C/D",         href: "/dashboard/facturacion/notas",       icon: FileMinus, permiso: "facturacion" },
      { label: "Cotizaciones",      href: "/dashboard/facturacion/cotizaciones",icon: FileCheck, permiso: "facturacion" },
    ],
  },
  {
    title: "Operaciones",
    defaultOpen: true,
    items: [
      { label: "Inventario",   href: "/dashboard/inventario",            icon: Package,     permiso: "inventario" },
      { label: "Bodegas",      href: "/dashboard/inventario/bodegas",    icon: Warehouse,   permiso: "inventario" },
      { label: "Movimientos",  href: "/dashboard/inventario/movimientos",icon: Activity,    permiso: "inventario" },
      { label: "Compras",      href: "/dashboard/compras",               icon: ShoppingCart,permiso: "compras"    },
      { label: "CRM",          href: "/dashboard/crm",                   icon: Users,       permiso: "crm"        },
      { label: "Métricas CRM", href: "/dashboard/crm/metricas",          icon: BarChart2,   permiso: "crm"        },
    ],
  },
  {
    title: "Contabilidad",
    defaultOpen: true,
    items: [
      { label: "Plan de Cuentas", href: "/dashboard/contabilidad/plan-cuentas", icon: BookOpen,  permiso: "contabilidad" },
      { label: "Asientos",        href: "/dashboard/contabilidad/asientos",     icon: BookMarked,permiso: "contabilidad" },
      { label: "Reglas",          href: "/dashboard/contabilidad/reglas",       icon: Zap,       permiso: "contabilidad" },
      { label: "Reportes",        href: "/dashboard/contabilidad/reportes",     icon: TrendingUp,permiso: "contabilidad" },
    ],
  },
  {
    title: "Reportes",
    defaultOpen: true,
    items: [
      { label: "Ventas",     href: "/dashboard/reportes/ventas",     icon: TrendingUp,    permiso: "reportes" },
      { label: "Inventario", href: "/dashboard/reportes/inventario", icon: BarChart2,     permiso: "reportes" },
      { label: "Compras",    href: "/dashboard/reportes/compras",    icon: ClipboardList, permiso: "reportes" },
    ],
  },
  {
    title: "Empresa",
    defaultOpen: true,
    items: [
      { label: "Perfil empresa", href: "/dashboard/empresa",          icon: Building2, permiso: "admin" },
      { label: "Usuarios",       href: "/dashboard/empresa/usuarios", icon: UserCog,   permiso: "admin" },
    ],
  },
  {
    title: "Configuración",
    defaultOpen: true,
    items: [
      { label: "Configuración", href: "/dashboard/configuracion", icon: Settings, permiso: "admin" },
    ],
  },
]

interface SidebarProps {
  usuario: { nombre: string; rolGlobal: string }
  empresaRol: string
  permisos: string[]
  open: boolean
  onToggle: () => void
}

export function Sidebar({ usuario, empresaRol, permisos, open, onToggle }: SidebarProps) {
  const pathname = usePathname()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((s) => [s.title, s.defaultOpen ?? true]))
  )

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const initials = usuario.nombre
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col bg-sl-bg-sidebar transition-transform duration-300",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo + botón cerrar */}
      <div className="flex h-topbar shrink-0 items-center justify-between border-b border-sl-border/40 px-5">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-white">Soft</span>
          <span className="text-sl-purple">link ERP</span>
        </span>
        <button
          onClick={onToggle}
          title="Ocultar menú"
          className="rounded-md p-1 text-sl-muted transition-colors hover:text-sl-text"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => puedeVer(item.permiso, empresaRol, permisos)
          )
          if (visibleItems.length === 0) return null

          const isOpen = openSections[section.title] ?? true
          const hasActive = visibleItems.some((i) => isActive(i.href))

          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between px-2 py-1.5 group"
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest transition-colors",
                    hasActive && !isOpen
                      ? "text-sl-purple-light"
                      : "text-sl-muted group-hover:text-sl-text"
                  )}
                >
                  {section.title}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-sl-muted/60 transition-transform duration-200 group-hover:text-sl-muted",
                    !isOpen && "-rotate-90"
                  )}
                />
              </button>

              {isOpen && (
                <ul className="mt-0.5 space-y-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                          isActive(item.href)
                            ? "bg-sl-purple/[0.18] text-sl-purple-light font-medium"
                            : "text-sl-muted hover:bg-sl-purple/[0.12] hover:text-sl-text"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {/* Panel super_admin */}
        {usuario.rolGlobal === "super_admin" && (
          <div className="mb-1">
            <button
              onClick={() => toggleSection("Sistema")}
              className="flex w-full items-center justify-between px-2 py-1.5 group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-sl-muted transition-colors group-hover:text-sl-text">
                Sistema
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-sl-muted/60 transition-transform duration-200 group-hover:text-sl-muted",
                  !(openSections["Sistema"] ?? true) && "-rotate-90"
                )}
              />
            </button>
            {(openSections["Sistema"] ?? true) && (
              <ul className="mt-0.5 space-y-0.5">
                <li>
                  <Link
                    href="/dashboard/admin"
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                      pathname.startsWith("/dashboard/admin")
                        ? "bg-sl-purple/[0.18] text-sl-purple-light font-medium"
                        : "text-sl-muted hover:bg-sl-purple/[0.12] hover:text-sl-text"
                    )}
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    Admin global
                  </Link>
                </li>
              </ul>
            )}
          </div>
        )}
      </nav>

      {/* Footer con usuario */}
      <div className="shrink-0 border-t border-sl-border/40 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sl-purple-dark text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sl-text">{usuario.nombre}</p>
            <p className="truncate text-xs text-sl-muted capitalize">{empresaRol}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
