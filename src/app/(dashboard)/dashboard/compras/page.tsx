"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Trash2, AlertTriangle, CheckCircle, ShoppingCart, PackageCheck, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatRutDisplay } from "@/lib/chile/rut"

interface Compra {
  id: string
  proveedor_id: string
  proveedor_rut: string
  proveedor_razon_social: string
  fecha: string
  estado: string
  neto: number
  iva: number
  total: number
  notas: string | null
  creado_en: string
}

interface Bodega {
  id: string
  nombre: string
  activa: boolean
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function fmtFecha(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const ESTADO_CONFIG = {
  borrador:  { label: "Borrador",  bg: "rgba(136,136,153,0.15)", color: "#888899" },
  ordenada:  { label: "Ordenada",  bg: "rgba(186,117,23,0.15)",  color: "#BA7517" },
  recibida:  { label: "Recibida",  bg: "rgba(29,158,117,0.15)",  color: "#1D9E75" },
} as const

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recibirModal, setRecibirModal] = useState<Compra | null>(null)
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("")
  const [recibiendo, setRecibiendo] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (opts?: { q?: string; estado?: string }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.q) params.set("search", opts.q)
      if (opts?.estado) params.set("estado", opts.estado)
      const res = await fetch(`/api/compras?${params}`)
      const json = await res.json()
      if (res.ok) setCompras(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch("/api/bodegas").then((r) => r.json()).then((j) =>
      setBodegas((j.data ?? []).filter((b: Bodega) => b.activa))
    )
  }, [load])

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load({ q: v, estado: estadoFiltro }), 350)
  }

  function onEstado(v: string) {
    setEstadoFiltro(v)
    load({ q: search, estado: v })
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar esta orden de compra?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/compras/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al eliminar", false)
      notify("Orden eliminada", true)
      load({ q: search, estado: estadoFiltro })
    } finally {
      setDeletingId(null)
    }
  }

  async function ordenar(id: string) {
    const res = await fetch(`/api/compras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "ordenada" }),
    })
    const json = await res.json()
    if (!res.ok) return notify(json.error ?? "Error al ordenar", false)
    notify("Orden marcada como ordenada", true)
    load({ q: search, estado: estadoFiltro })
  }

  async function recibir() {
    if (!recibirModal || !bodegaSeleccionada) return notify("Selecciona una bodega", false)
    setRecibiendo(true)
    try {
      const res = await fetch(`/api/compras/${recibirModal.id}/recibir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodegaId: bodegaSeleccionada }),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al recibir", false)
      notify(`Compra recibida — ${json.data.itemsIngresados} producto(s) ingresado(s) al inventario`, true)
      setRecibirModal(null)
      setBodegaSeleccionada("")
      load({ q: search, estado: estadoFiltro })
    } finally {
      setRecibiendo(false)
    }
  }

  // Stats
  const borradores = compras.filter((c) => c.estado === "borrador").length
  const ordenadas  = compras.filter((c) => c.estado === "ordenada").length
  const recibidas  = compras.filter((c) => c.estado === "recibida").length
  const totalPeriodo = compras.reduce((s, c) => s + c.total, 0)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Órdenes de compra</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Gestión de compras a proveedores</p>
        </div>
        <Link
          href="/dashboard/compras/nueva"
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Nueva compra
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Borradores", value: borradores, color: "text-sl-muted" },
          { label: "Ordenadas",  value: ordenadas,  color: "text-sl-warning" },
          { label: "Recibidas",  value: recibidas,  color: "text-sl-success" },
          { label: "Total período", value: fmtCLP(totalPeriodo), color: "text-sl-text" },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
            <p className="text-xs text-sl-muted">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar por proveedor..."
            className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => onEstado(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="ordenada">Ordenada</option>
          <option value="recibida">Recibida</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Proveedor</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted sm:table-cell">Fecha</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-sl-muted">Estado</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : compras.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-sl-muted/40" />
                  <p className="text-sm text-sl-muted">No hay órdenes de compra</p>
                  <p className="mt-1 text-xs text-sl-muted/60">Crea la primera orden para comenzar</p>
                </td>
              </tr>
            ) : (
              compras.map((c) => {
                const cfg = ESTADO_CONFIG[c.estado as keyof typeof ESTADO_CONFIG]
                const esEditable = c.estado !== "recibida"
                return (
                  <tr key={c.id} className="border-b border-sl-border/50 last:border-0 hover:bg-sl-purple/[0.04]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sl-text">{c.proveedor_razon_social}</p>
                      <p className="text-xs text-sl-muted">{formatRutDisplay(c.proveedor_rut)}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-sl-muted sm:table-cell">{fmtFecha(c.fecha)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: cfg?.bg, color: cfg?.color }}
                      >
                        {cfg?.label ?? c.estado}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums font-semibold text-sl-text md:table-cell">
                      {fmtCLP(c.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.estado === "borrador" && (
                          <button
                            onClick={() => ordenar(c.id)}
                            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-sl-muted transition-colors hover:bg-sl-warning/[0.15] hover:text-sl-warning"
                            title="Marcar como ordenada (enviada al proveedor)"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Ordenar
                          </button>
                        )}
                        {c.estado === "ordenada" && (
                          <button
                            onClick={() => { setRecibirModal(c); setBodegaSeleccionada(bodegas[0]?.id ?? "") }}
                            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-sl-muted transition-colors hover:bg-sl-success/[0.15] hover:text-sl-success"
                            title="Marcar como recibida e ingresar a inventario"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Recibir
                          </button>
                        )}
                        {esEditable && (
                          <Link
                            href={`/dashboard/compras/${c.id}/editar`}
                            className="rounded-md px-2 py-1.5 text-xs text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light"
                          >
                            Editar
                          </Link>
                        )}
                        {esEditable && (
                          <button
                            onClick={() => del(c.id)}
                            disabled={deletingId === c.id}
                            className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-danger/[0.15] hover:text-sl-danger disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {!loading && compras.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {compras.length} orden{compras.length !== 1 ? "es" : ""}
          </div>
        )}
      </div>

      {/* Modal recibir compra */}
      {recibirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <div>
                <h2 className="font-medium text-sl-text">Recibir compra</h2>
                <p className="mt-0.5 text-xs text-sl-muted">{recibirModal.proveedor_razon_social} · {fmtFecha(recibirModal.fecha)}</p>
              </div>
              <button onClick={() => setRecibirModal(null)} className="text-sl-muted hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-sl-border/60 bg-sl-bg-dark/30 px-4 py-3 text-sm">
                <p className="text-sl-muted">Los productos vinculados a esta compra serán ingresados al inventario de la bodega seleccionada.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Bodega de destino <span className="text-sl-danger">*</span></label>
                {bodegas.length === 0 ? (
                  <p className="text-sm text-sl-warning">No hay bodegas activas. Crea una en Operaciones → Bodegas.</p>
                ) : (
                  <select
                    value={bodegaSeleccionada}
                    onChange={(e) => setBodegaSeleccionada(e.target.value)}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    {bodegas.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={() => setRecibirModal(null)} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">Cancelar</button>
              <button
                onClick={recibir}
                disabled={recibiendo || !bodegaSeleccionada}
                className="flex items-center gap-1.5 rounded-lg bg-sl-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <PackageCheck className="h-4 w-4" />
                {recibiendo ? "Ingresando..." : "Confirmar recepción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl", toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white")}>
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
