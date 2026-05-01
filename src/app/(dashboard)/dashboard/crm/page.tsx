"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, X, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  Pencil, Trash2, Calendar, DollarSign, User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"

interface Oportunidad {
  id: string
  cliente_id: string | null
  cliente_razon_social: string | null
  titulo: string
  descripcion: string | null
  valor_estimado: number
  etapa: string
  fecha_cierre_estimada: string | null
  creado_en: string
}

interface Cliente { id: string; razon_social: string }

interface FormState {
  clienteId: string
  titulo: string
  descripcion: string
  valorEstimado: string
  etapa: string
  fechaCierreEstimada: string
}

const ETAPAS = [
  { key: "prospecto",   label: "Prospecto",   color: "#888899", bg: "rgba(136,136,153,0.12)" },
  { key: "propuesta",   label: "Propuesta",   color: "#7F77DD", bg: "rgba(127,119,221,0.12)" },
  { key: "negociacion", label: "Negociación", color: "#BA7517", bg: "rgba(186,117,23,0.12)"  },
  { key: "ganado",      label: "Ganado",      color: "#1D9E75", bg: "rgba(29,158,117,0.12)"  },
  { key: "perdido",     label: "Perdido",     color: "#E24B4A", bg: "rgba(226,75,74,0.12)"   },
] as const

const EMPTY: FormState = {
  clienteId: "",
  titulo: "",
  descripcion: "",
  valorEstimado: "",
  etapa: "prospecto",
  fechaCierreEstimada: "",
}

function fmtCLP(n: number) {
  if (n === 0) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function fmtFecha(s: string | null) {
  if (!s) return null
  return new Date(s + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
}

function isVencida(s: string | null) {
  if (!s) return false
  return new Date(s) < new Date()
}

export default function CRMPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/crm/oportunidades")
      const json = await res.json() as ApiResponse<Oportunidad[]>
      if (res.ok) setOportunidades(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch("/api/clientes").then((r) => r.json()).then((j: ApiResponse<Cliente[]>) =>
      setClientes(j.data ?? [])
    )
  }, [load])

  function openCreate() { setForm(EMPTY); setEditingId(null); setModal("create") }

  function openEdit(o: Oportunidad) {
    setForm({
      clienteId: o.cliente_id ?? "",
      titulo: o.titulo,
      descripcion: o.descripcion ?? "",
      valorEstimado: o.valor_estimado > 0 ? String(o.valor_estimado) : "",
      etapa: o.etapa,
      fechaCierreEstimada: o.fecha_cierre_estimada?.split("T")[0] ?? "",
    })
    setEditingId(o.id)
    setModal("edit")
  }

  function closeModal() { setModal(null); setEditingId(null) }

  async function save() {
    if (!form.titulo.trim()) return notify("El título es requerido", false)
    setSaving(true)
    try {
      const payload = {
        clienteId: form.clienteId || null,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        valorEstimado: parseInt(form.valorEstimado) || 0,
        etapa: form.etapa,
        fechaCierreEstimada: form.fechaCierreEstimada || null,
      }
      const url = modal === "edit" ? `/api/crm/oportunidades/${editingId}` : "/api/crm/oportunidades"
      const res = await fetch(url, {
        method: modal === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify(modal === "edit" ? "Oportunidad actualizada" : "Oportunidad creada", true)
      closeModal()
      load()
    } finally {
      setSaving(false)
    }
  }

  async function moverEtapa(id: string, etapaActual: string, direccion: "prev" | "next") {
    const idx = ETAPAS.findIndex((e) => e.key === etapaActual)
    const nuevoIdx = direccion === "next" ? idx + 1 : idx - 1
    if (nuevoIdx < 0 || nuevoIdx >= ETAPAS.length) return

    const res = await fetch(`/api/crm/oportunidades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etapa: ETAPAS[nuevoIdx].key }),
    })
    if (!res.ok) return notify("Error al mover oportunidad", false)
    setOportunidades((prev) =>
      prev.map((o) => (o.id === id ? { ...o, etapa: ETAPAS[nuevoIdx].key } : o))
    )
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar esta oportunidad?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/crm/oportunidades/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al eliminar", false)
      notify("Oportunidad eliminada", true)
      load()
    } finally {
      setDeletingId(null)
    }
  }

  // KPIs
  const activas = oportunidades.filter((o) => o.etapa !== "ganado" && o.etapa !== "perdido")
  const ganadas = oportunidades.filter((o) => o.etapa === "ganado")
  const totalPipeline = activas.reduce((s, o) => s + o.valor_estimado, 0)
  const totalGanado   = ganadas.reduce((s, o) => s + o.valor_estimado, 0)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">CRM — Pipeline</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Seguimiento de oportunidades comerciales</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Nueva oportunidad
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Oportunidades activas</p>
          <p className="mt-1 text-2xl font-semibold text-sl-text">{activas.length}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Valor pipeline</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-sl-purple">{fmtCLP(totalPipeline)}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Ganadas</p>
          <p className="mt-1 text-2xl font-semibold text-sl-success">{ganadas.length}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Valor ganado</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-sl-success">{fmtCLP(totalGanado)}</p>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="py-16 text-center text-sm text-sl-muted">Cargando...</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${ETAPAS.length * 260}px` }}>
            {ETAPAS.map((etapa) => {
              const cards = oportunidades.filter((o) => o.etapa === etapa.key)
              const valorColumna = cards.reduce((s, o) => s + o.valor_estimado, 0)
              const etapaIdx = ETAPAS.findIndex((e) => e.key === etapa.key)

              return (
                <div key={etapa.key} className="flex w-64 shrink-0 flex-col">
                  {/* Cabecera columna */}
                  <div
                    className="mb-3 flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: etapa.bg, borderLeft: `3px solid ${etapa.color}` }}
                  >
                    <div>
                      <span className="text-xs font-semibold" style={{ color: etapa.color }}>{etapa.label}</span>
                      <span className="ml-2 text-xs text-sl-muted">{cards.length}</span>
                    </div>
                    {valorColumna > 0 && (
                      <span className="text-xs tabular-nums text-sl-muted">{fmtCLP(valorColumna)}</span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2">
                    {cards.length === 0 && (
                      <div className="rounded-lg border border-sl-border/40 border-dashed px-3 py-6 text-center text-xs text-sl-muted/50">
                        Sin oportunidades
                      </div>
                    )}
                    {cards.map((o) => {
                      const vencida = isVencida(o.fecha_cierre_estimada) && etapa.key !== "ganado" && etapa.key !== "perdido"
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            "rounded-card border bg-sl-bg-card p-3 transition-shadow hover:shadow-md hover:shadow-black/20",
                            vencida ? "border-sl-danger/30" : "border-sl-border"
                          )}
                        >
                          <p className="mb-1 text-sm font-medium leading-snug text-sl-text">{o.titulo}</p>

                          {o.cliente_razon_social && (
                            <div className="mb-1.5 flex items-center gap-1 text-xs text-sl-muted">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{o.cliente_razon_social}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            {o.valor_estimado > 0 ? (
                              <div className="flex items-center gap-1 text-xs font-medium text-sl-text">
                                <DollarSign className="h-3 w-3 text-sl-muted" />
                                {fmtCLP(o.valor_estimado)}
                              </div>
                            ) : <span />}

                            {o.fecha_cierre_estimada && (
                              <div className={cn("flex items-center gap-1 text-xs", vencida ? "text-sl-danger" : "text-sl-muted")}>
                                <Calendar className="h-3 w-3" />
                                {fmtFecha(o.fecha_cierre_estimada)}
                              </div>
                            )}
                          </div>

                          {/* Acciones */}
                          <div className="mt-2 flex items-center justify-between border-t border-sl-border/40 pt-2">
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => moverEtapa(o.id, o.etapa, "prev")}
                                disabled={etapaIdx === 0}
                                title="Mover a etapa anterior"
                                className="rounded p-1 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light disabled:opacity-20"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moverEtapa(o.id, o.etapa, "next")}
                                disabled={etapaIdx === ETAPAS.length - 1}
                                title="Mover a siguiente etapa"
                                className="rounded p-1 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light disabled:opacity-20"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => openEdit(o)}
                                className="rounded p-1 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => del(o.id)}
                                disabled={deletingId === o.id}
                                className="rounded p-1 text-sl-muted transition-colors hover:bg-sl-danger/[0.15] hover:text-sl-danger disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">
                {modal === "create" ? "Nueva oportunidad" : "Editar oportunidad"}
              </h2>
              <button onClick={closeModal} className="text-sl-muted hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {/* Título */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Título <span className="text-sl-danger">*</span></label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Propuesta sistema ERP para Empresa XYZ"
                  autoFocus
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>

              {/* Cliente + Etapa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Cliente</label>
                  <select
                    value={form.clienteId}
                    onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    <option value="">Sin cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.razon_social}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Etapa</label>
                  <select
                    value={form.etapa}
                    onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    {ETAPAS.map((e) => (
                      <option key={e.key} value={e.key}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Valor + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Valor estimado (CLP)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.valorEstimado}
                    onChange={(e) => setForm((f) => ({ ...f, valorEstimado: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Cierre estimado</label>
                  <input
                    type="date"
                    value={form.fechaCierreEstimada}
                    onChange={(e) => setForm((f) => ({ ...f, fechaCierreEstimada: e.target.value }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Contexto, necesidades del cliente, próximos pasos..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={closeModal} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">Cancelar</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Guardando..." : modal === "create" ? "Crear oportunidad" : "Guardar cambios"}
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
