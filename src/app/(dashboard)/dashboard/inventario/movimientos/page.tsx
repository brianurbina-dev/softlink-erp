"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, X, AlertTriangle, CheckCircle, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface MovimientoRow {
  id: string
  tipo: string
  producto_id: string
  producto_codigo: string
  producto_nombre: string
  bodega_id: string
  bodega_nombre: string
  cantidad: number
  costo_unitario: number
  referencia_tipo: string | null
  referencia_id: string | null
  notas: string | null
  creado_en: string
}

interface Producto {
  id: string
  codigo: string
  nombre: string
  unidad: string
}

interface Bodega {
  id: string
  nombre: string
  activa: boolean
}

interface FormState {
  tipo: "entrada" | "salida" | "ajuste"
  productoId: string
  bodegaId: string
  cantidad: string
  costoUnitario: string
  notas: string
}

const EMPTY: FormState = {
  tipo: "entrada",
  productoId: "",
  bodegaId: "",
  cantidad: "",
  costoUnitario: "",
  notas: "",
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const TIPO_CONFIG = {
  entrada: { label: "Entrada", icon: ArrowDownLeft, color: "text-sl-success", bg: "rgba(29,158,117,0.15)" },
  salida:  { label: "Salida",  icon: ArrowUpRight,  color: "text-sl-danger",  bg: "rgba(226,75,74,0.15)" },
  ajuste:  { label: "Ajuste", icon: RefreshCw,      color: "text-sl-warning", bg: "rgba(186,117,23,0.15)" },
} as const

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroBodega, setFiltroBodega] = useState("")
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async (opts?: { tipo?: string; bodega?: string }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.tipo) params.set("tipo", opts.tipo)
      if (opts?.bodega) params.set("bodega", opts.bodega)
      const res = await fetch(`/api/inventario/movimientos?${params}`)
      const json = await res.json()
      if (res.ok) setMovimientos(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    Promise.all([
      fetch("/api/productos").then((r) => r.json()),
      fetch("/api/bodegas").then((r) => r.json()),
    ]).then(([pJson, bJson]) => {
      setProductos(pJson.data ?? [])
      setBodegas((bJson.data ?? []).filter((b: Bodega) => b.activa))
    })
  }, [load])

  function onFiltroTipo(v: string) {
    setFiltroTipo(v)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load({ tipo: v, bodega: filtroBodega }), 200)
  }

  function onFiltroBodega(v: string) {
    setFiltroBodega(v)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load({ tipo: filtroTipo, bodega: v }), 200)
  }

  function openModal() {
    setForm(EMPTY)
    setModal(true)
  }

  async function save() {
    if (!form.productoId) return notify("Selecciona un producto", false)
    if (!form.bodegaId) return notify("Selecciona una bodega", false)
    const cantidad = parseInt(form.cantidad)
    if (!cantidad || cantidad < 1) return notify("La cantidad debe ser mayor a 0", false)

    setSaving(true)
    try {
      const res = await fetch("/api/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo,
          productoId: form.productoId,
          bodegaId: form.bodegaId,
          cantidad,
          costoUnitario: parseInt(form.costoUnitario) || 0,
          notas: form.notas.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al registrar", false)
      notify("Movimiento registrado", true)
      setModal(false)
      load({ tipo: filtroTipo, bodega: filtroBodega })
    } finally {
      setSaving(false)
    }
  }

  const entradasCount = movimientos.filter((m) => m.tipo === "entrada").length
  const salidasCount  = movimientos.filter((m) => m.tipo === "salida").length
  const ajustesCount  = movimientos.filter((m) => m.tipo === "ajuste").length

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Movimientos de inventario</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Registro de entradas, salidas y ajustes de stock</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Registrar movimiento
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {(["entrada", "salida", "ajuste"] as const).map((tipo) => {
          const cfg = TIPO_CONFIG[tipo]
          const count = tipo === "entrada" ? entradasCount : tipo === "salida" ? salidasCount : ajustesCount
          const Icon = cfg.icon
          return (
            <div
              key={tipo}
              onClick={() => onFiltroTipo(filtroTipo === tipo ? "" : tipo)}
              className={cn("cursor-pointer rounded-card border bg-sl-bg-card px-4 py-3 transition-colors", filtroTipo === tipo ? "border-sl-purple/40 bg-sl-purple/[0.06]" : "border-sl-border")}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                <p className="text-xs text-sl-muted">{cfg.label}s</p>
              </div>
              <p className="mt-1 text-2xl font-semibold text-sl-text">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          value={filtroTipo}
          onChange={(e) => onFiltroTipo(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
        >
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
        </select>
        <select
          value={filtroBodega}
          onChange={(e) => onFiltroBodega(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
        >
          <option value="">Todas las bodegas</option>
          {bodegas.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Producto</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted sm:table-cell">Bodega</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Cantidad</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Costo unit.</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">Notas</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted xl:table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Activity className="mx-auto mb-3 h-10 w-10 text-sl-muted/40" />
                  <p className="text-sm text-sl-muted">Sin movimientos registrados</p>
                  <p className="mt-1 text-xs text-sl-muted/60">Los movimientos de inventario aparecerán aquí</p>
                </td>
              </tr>
            ) : (
              movimientos.map((m) => {
                const cfg = TIPO_CONFIG[m.tipo as keyof typeof TIPO_CONFIG]
                const Icon = cfg?.icon ?? Activity
                return (
                  <tr key={m.id} className="border-b border-sl-border/50 last:border-0 hover:bg-sl-purple/[0.04]">
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: cfg?.bg ?? "transparent", color: cfg?.color?.replace("text-", "") ?? "inherit" }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cfg?.label ?? m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sl-text">{m.producto_nombre}</p>
                      <p className="text-xs text-sl-muted">{m.producto_codigo}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-sl-muted sm:table-cell">{m.bodega_nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-sl-text">
                      {m.tipo === "salida" ? "-" : "+"}{m.cantidad.toLocaleString("es-CL")}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted md:table-cell">
                      {m.costo_unitario > 0 ? fmtCLP(m.costo_unitario) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-sl-muted lg:table-cell">{m.notas || "—"}</td>
                    <td className="hidden px-4 py-3 text-xs text-sl-muted xl:table-cell">{fmtDateTime(m.creado_en)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {!loading && movimientos.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {movimientos.length} movimiento{movimientos.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Modal nuevo movimiento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">Registrar movimiento</h2>
              <button onClick={() => setModal(false)} className="text-sl-muted transition-colors hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {/* Tipo */}
              <div>
                <label className="mb-2 block text-xs font-medium text-sl-muted">Tipo de movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["entrada", "salida", "ajuste"] as const).map((t) => {
                    const cfg = TIPO_CONFIG[t]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border py-3 text-xs font-medium transition-colors",
                          form.tipo === t
                            ? "border-sl-purple bg-sl-purple/[0.12] text-sl-purple-light"
                            : "border-sl-border text-sl-muted hover:border-sl-purple/40 hover:text-sl-text"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Producto */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Producto <span className="text-sl-danger">*</span></label>
                <select
                  value={form.productoId}
                  onChange={(e) => setForm((f) => ({ ...f, productoId: e.target.value }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                >
                  <option value="">Selecciona un producto...</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Bodega */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Bodega <span className="text-sl-danger">*</span></label>
                <select
                  value={form.bodegaId}
                  onChange={(e) => setForm((f) => ({ ...f, bodegaId: e.target.value }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                >
                  <option value="">Selecciona una bodega...</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cantidad */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Cantidad <span className="text-sl-danger">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={form.cantidad}
                    onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                </div>
                {/* Costo unitario — solo para entradas */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                    Costo unit. (CLP)
                    {form.tipo !== "entrada" && <span className="ml-1 text-sl-muted/50">—</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.costoUnitario}
                    onChange={(e) => setForm((f) => ({ ...f, costoUnitario: e.target.value }))}
                    placeholder="0"
                    disabled={form.tipo !== "entrada"}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Notas</label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Referencia, motivo o descripción..."
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>

              {form.tipo === "salida" && (
                <div className="flex items-start gap-2 rounded-lg border border-sl-warning/30 bg-sl-warning/[0.08] px-3 py-2.5 text-xs text-sl-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  El sistema verificará que haya stock suficiente antes de registrar la salida.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={() => setModal(false)} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text">Cancelar</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Registrando..." : "Registrar movimiento"}
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
