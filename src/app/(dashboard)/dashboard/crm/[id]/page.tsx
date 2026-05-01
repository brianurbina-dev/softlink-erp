"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Plus, X, Trash2, CheckCircle, AlertTriangle,
  Phone, Calendar, Mail, CheckSquare, FileText, Circle,
  User, DollarSign, ChevronRight, Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"
import { ETAPAS_CRM, TIPOS_ACTIVIDAD } from "@/lib/validations/crm"

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

interface Actividad {
  id: string
  oportunidad_id: string
  tipo: string
  descripcion: string
  fecha: string
  completada: boolean
  creado_en: string
}

const ETAPAS_META = [
  { key: "prospecto",   label: "Prospecto",   color: "#888899" },
  { key: "propuesta",   label: "Propuesta",   color: "#7F77DD" },
  { key: "negociacion", label: "Negociación", color: "#BA7517" },
  { key: "ganado",      label: "Ganado",      color: "#1D9E75" },
  { key: "perdido",     label: "Perdido",     color: "#E24B4A" },
] as const

const TIPO_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  llamada:  { label: "Llamada",  Icon: Phone        },
  reunion:  { label: "Reunión",  Icon: Calendar     },
  email:    { label: "Email",    Icon: Mail         },
  tarea:    { label: "Tarea",    Icon: CheckSquare  },
  nota:     { label: "Nota",     Icon: FileText     },
}

function fmtCLP(n: number) {
  if (n === 0) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function fmtFecha(s: string | null | undefined) {
  if (!s) return null
  const d = new Date(s + (s.length === 10 ? "T12:00:00" : ""))
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })
}

export default function OportunidadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [oportunidad, setOportunidad] = useState<Oportunidad | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // form nueva actividad
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tipo: "nota", descripcion: "", fecha: new Date().toISOString().split("T")[0] })
  const [saving, setSaving] = useState(false)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadActividades = useCallback(async () => {
    const res = await fetch(`/api/crm/oportunidades/${id}/actividades`)
    const json = await res.json() as ApiResponse<Actividad[]>
    if (res.ok) setActividades(json.data ?? [])
  }, [id])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/crm/oportunidades?id=${id}`)
        // oportunidades endpoint doesn't filter by id — fetch all and find
        const json = await res.json() as ApiResponse<Oportunidad[]>
        const op = (json.data ?? []).find((o) => o.id === id)
        if (!op) { router.push("/dashboard/crm"); return }
        setOportunidad(op)
        await loadActividades()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, loadActividades, router])

  async function addActividad() {
    if (!form.descripcion.trim()) return notify("La descripción es requerida", false)
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/oportunidades/${id}/actividades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, completada: false }),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify("Actividad registrada", true)
      setForm({ tipo: "nota", descripcion: "", fecha: new Date().toISOString().split("T")[0] })
      setShowForm(false)
      loadActividades()
    } finally {
      setSaving(false)
    }
  }

  async function toggleCompletada(a: Actividad) {
    await fetch(`/api/crm/actividades/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completada: !a.completada }),
    })
    setActividades((prev) => prev.map((x) => x.id === a.id ? { ...x, completada: !x.completada } : x))
  }

  async function delActividad(actId: string) {
    if (!confirm("¿Eliminar esta actividad?")) return
    await fetch(`/api/crm/actividades/${actId}`, { method: "DELETE" })
    setActividades((prev) => prev.filter((x) => x.id !== actId))
    notify("Actividad eliminada", true)
  }

  const etapaMeta = ETAPAS_META.find((e) => e.key === oportunidad?.etapa)
  const vencida = oportunidad?.fecha_cierre_estimada
    ? new Date(oportunidad.fecha_cierre_estimada) < new Date() && oportunidad.etapa !== "ganado" && oportunidad.etapa !== "perdido"
    : false

  if (loading) {
    return <div className="py-20 text-center text-sm text-sl-muted">Cargando...</div>
  }

  if (!oportunidad) return null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/crm"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-sl-muted hover:text-sl-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al pipeline
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-page-title text-sl-text">{oportunidad.titulo}</h1>
            {oportunidad.cliente_razon_social && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-sl-muted">
                <User className="h-3.5 w-3.5" />
                {oportunidad.cliente_razon_social}
              </div>
            )}
          </div>
          <Link
            href={`/dashboard/crm`}
            onClick={(e) => { e.preventDefault(); router.push("/dashboard/crm") }}
            className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-2 text-sm text-sl-muted hover:border-sl-purple/40 hover:text-sl-text"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar en pipeline
          </Link>
        </div>
      </div>

      {/* Info cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Etapa</p>
          <p className="mt-1.5 text-sm font-semibold" style={{ color: etapaMeta?.color ?? "#f0f0f5" }}>
            {etapaMeta?.label ?? oportunidad.etapa}
          </p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Valor estimado</p>
          <div className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-sl-text">
            <DollarSign className="h-3.5 w-3.5 text-sl-muted" />
            {fmtCLP(oportunidad.valor_estimado)}
          </div>
        </div>
        <div className={cn("rounded-card border bg-sl-bg-card p-4", vencida ? "border-sl-danger/40" : "border-sl-border")}>
          <p className="text-xs text-sl-muted">Cierre estimado</p>
          <p className={cn("mt-1.5 text-sm font-semibold", vencida ? "text-sl-danger" : "text-sl-text")}>
            {fmtFecha(oportunidad.fecha_cierre_estimada) ?? "—"}
            {vencida && <span className="ml-1 text-xs font-normal">(vencida)</span>}
          </p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Actividades</p>
          <p className="mt-1.5 text-sm font-semibold text-sl-text">
            {actividades.length}
            <span className="ml-1 text-xs font-normal text-sl-muted">
              ({actividades.filter((a) => a.completada).length} completadas)
            </span>
          </p>
        </div>
      </div>

      {oportunidad.descripcion && (
        <div className="mb-6 rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted mb-1">Descripción</p>
          <p className="text-sm text-sl-text">{oportunidad.descripcion}</p>
        </div>
      )}

      {/* Timeline de actividades */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card">
        <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
          <h2 className="text-sm font-semibold text-sl-text">Seguimiento</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-sl-purple-dark"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva actividad
          </button>
        </div>

        {/* Formulario nueva actividad */}
        {showForm && (
          <div className="border-b border-sl-border bg-sl-bg-dark/40 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                >
                  {TIPOS_ACTIVIDAD.map((t) => (
                    <option key={t} value={t}>{TIPO_META[t]?.label ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                />
              </div>
              <div className="sm:col-span-1 flex items-end gap-2">
                <button
                  onClick={addActividad}
                  disabled={saving}
                  className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Agregar"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-sl-border px-3 py-2 text-sm text-sl-muted hover:text-sl-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                Descripción <span className="text-sl-danger">*</span>
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Describe la actividad, resultado o próximo paso..."
                rows={2}
                className="w-full resize-none rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="divide-y divide-sl-border/50">
          {actividades.length === 0 && (
            <div className="py-12 text-center text-sm text-sl-muted">
              Sin actividades registradas
            </div>
          )}
          {actividades.map((a) => {
            const meta = TIPO_META[a.tipo] ?? TIPO_META.nota
            const Icon = meta.Icon
            return (
              <div key={a.id} className={cn("flex gap-4 p-4 transition-colors", a.completada && "opacity-60")}>
                {/* Ícono tipo */}
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sl-purple/10">
                  <Icon className="h-3.5 w-3.5 text-sl-purple-light" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-sl-purple-light">{meta.label}</span>
                    <span className="text-xs text-sl-muted">{fmtFecha(a.fecha)}</span>
                  </div>
                  <p className={cn("mt-0.5 text-sm", a.completada ? "text-sl-muted line-through" : "text-sl-text")}>
                    {a.descripcion}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleCompletada(a)}
                    title={a.completada ? "Marcar pendiente" : "Marcar completada"}
                    className={cn(
                      "rounded p-1 transition-colors",
                      a.completada
                        ? "text-sl-success hover:bg-sl-success/10"
                        : "text-sl-muted hover:bg-sl-success/10 hover:text-sl-success"
                    )}
                  >
                    {a.completada ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => delActividad(a.id)}
                    className="rounded p-1 text-sl-muted transition-colors hover:bg-sl-danger/10 hover:text-sl-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl", toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white")}>
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
