"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Loader2,
  AlertCircle,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Cuenta {
  id: string
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  cuenta_padre_id: string | null
  acepta_movimientos: boolean
  activo: boolean
}

interface CuentaTree extends Cuenta {
  hijos: CuentaTree[]
}

const TIPOS: Record<string, { label: string; color: string }> = {
  activo:     { label: "Activo",     color: "bg-blue-500/15 text-blue-400" },
  pasivo:     { label: "Pasivo",     color: "bg-red-500/15 text-red-400" },
  patrimonio: { label: "Patrimonio", color: "bg-purple-500/15 text-purple-400" },
  ingreso:    { label: "Ingreso",    color: "bg-green-500/15 text-green-400" },
  gasto:      { label: "Gasto",      color: "bg-amber-500/15 text-amber-400" },
}

function buildTree(cuentas: Cuenta[]): CuentaTree[] {
  const map = new Map<string, CuentaTree>()
  cuentas.forEach((c) => map.set(c.id, { ...c, hijos: [] }))
  const roots: CuentaTree[] = []
  map.forEach((c) => {
    if (c.cuenta_padre_id && map.has(c.cuenta_padre_id)) {
      map.get(c.cuenta_padre_id)!.hijos.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

const EMPTY_FORM = {
  codigo: "",
  nombre: "",
  tipo: "activo" as string,
  subtipo: "",
  cuentaPadreId: null as string | null,
  aceptaMovimientos: true,
}

function CuentaNode({
  cuenta,
  level,
  onAdd,
  onEdit,
  onDelete,
  onToggleActivo,
}: {
  cuenta: CuentaTree
  level: number
  onAdd: (padreId: string, tipo: string) => void
  onEdit: (cuenta: Cuenta) => void
  onDelete: (id: string, nombre: string) => void
  onToggleActivo: (id: string, activo: boolean) => void
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const tipoInfo = TIPOS[cuenta.tipo] ?? { label: cuenta.tipo, color: "bg-sl-border text-sl-muted" }
  const hasHijos = cuenta.hijos.length > 0

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sl-purple/[0.06]",
          !cuenta.activo && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + level * 20}px` }}
      >
        <button
          onClick={() => hasHijos && setExpanded((v) => !v)}
          className={cn("h-4 w-4 shrink-0 text-sl-muted", !hasHijos && "cursor-default")}
        >
          {hasHijos ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </button>

        <span className="w-20 shrink-0 font-mono text-xs text-sl-muted">{cuenta.codigo}</span>

        <span className={cn("flex-1 text-sm", cuenta.activo ? "text-sl-text" : "text-sl-muted line-through")}>
          {cuenta.nombre}
        </span>

        {!cuenta.acepta_movimientos && (
          <span className="hidden rounded px-1.5 py-0.5 text-[10px] font-medium text-sl-muted/60 ring-1 ring-sl-border/50 group-hover:inline-block">
            agrupadora
          </span>
        )}

        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", tipoInfo.color)}>
          {tipoInfo.label}
        </span>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onAdd(cuenta.id, cuenta.tipo)}
            title="Agregar subcuenta"
            className="rounded p-1 text-sl-muted hover:bg-sl-purple/20 hover:text-sl-purple-light"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(cuenta)}
            title="Editar"
            className="rounded p-1 text-sl-muted hover:bg-sl-purple/20 hover:text-sl-purple-light"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToggleActivo(cuenta.id, !cuenta.activo)}
            title={cuenta.activo ? "Desactivar" : "Activar"}
            className={cn(
              "rounded p-1 text-xs font-medium",
              cuenta.activo
                ? "text-sl-muted hover:text-amber-400"
                : "text-amber-400 hover:text-sl-muted"
            )}
          >
            {cuenta.activo ? "●" : "○"}
          </button>
          {!hasHijos && (
            <button
              onClick={() => onDelete(cuenta.id, cuenta.nombre)}
              title="Eliminar"
              className="rounded p-1 text-sl-muted hover:bg-red-500/20 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && hasHijos && (
        <div>
          {cuenta.hijos.map((hijo) => (
            <CuentaNode
              key={hijo.id}
              cuenta={hijo}
              level={level + 1}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActivo={onToggleActivo}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-sl-border bg-sl-bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-sl-text">{title}</h2>
          <button onClick={onClose} className="text-sl-muted hover:text-sl-text">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function PlanCuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [initLoading, setInitLoading] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/contabilidad/plan-cuentas")
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCuentas(json.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const tree = buildTree(cuentas)

  function openNew(padreId: string | null = null, tipo = "activo") {
    setEditId(null)
    setForm({ ...EMPTY_FORM, cuentaPadreId: padreId, tipo })
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(cuenta: Cuenta) {
    setEditId(cuenta.id)
    setForm({
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      subtipo: cuenta.subtipo ?? "",
      cuentaPadreId: cuenta.cuenta_padre_id,
      aceptaMovimientos: cuenta.acepta_movimientos,
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleGuardar() {
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        subtipo: form.subtipo || null,
        cuentaPadreId: form.cuentaPadreId || null,
      }
      const url = editId
        ? `/api/contabilidad/plan-cuentas/${editId}`
        : "/api/contabilidad/plan-cuentas"
      const method = editId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) { setFormError(json.error); return }
      setModalOpen(false)
      await cargar()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la cuenta "${nombre}"?`)) return
    const res = await fetch(`/api/contabilidad/plan-cuentas/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.error) { alert(json.error); return }
    await cargar()
  }

  async function handleToggleActivo(id: string, activo: boolean) {
    await fetch(`/api/contabilidad/plan-cuentas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    })
    await cargar()
  }

  async function handleInicializar() {
    const mensaje = cuentas.length > 0
      ? `Ya existen ${cuentas.length} cuenta(s) en el plan.\n\nLas cuentas estándar existentes se restablecerán a sus valores originales. Las cuentas personalizadas (con códigos no estándar) no se modificarán.\n\n¿Continuar?`
      : "¿Cargar el plan de cuentas estándar Chile (SII)?\n\nSe crearán ~50 cuentas predefinidas según la clasificación SII."
    if (!confirm(mensaje)) return
    setInitLoading(true)
    try {
      const res = await fetch("/api/contabilidad/plan-cuentas/inicializar", { method: "POST" })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      const { insertadas, actualizadas } = json.data
      alert(`Operación completada:\n• ${insertadas} cuenta(s) nueva(s) creadas\n• ${actualizadas} cuenta(s) existentes restablecidas`)
      await cargar()
    } finally {
      setInitLoading(false)
    }
  }

  const padreOptions = cuentas.filter((c) => !c.acepta_movimientos || c.id === editId ? false : false)
  const todosParaPadre = cuentas

  const conteoActivas = cuentas.filter((c) => c.activo).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-sl-text">Plan de Cuentas</h1>
          <p className="mt-0.5 text-sm text-sl-muted">
            Estructura jerárquica de cuentas contables — clasificación SII Chile
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInicializar}
            disabled={initLoading || loading}
            title={cuentas.length > 0 ? "Restablecer cuentas estándar a valores originales" : "Cargar plan de cuentas Chile (SII)"}
            className="flex items-center gap-2 rounded-lg border border-sl-purple/40 bg-sl-purple/10 px-3 py-2 text-sm text-sl-purple-light transition-colors hover:bg-sl-purple/20 disabled:opacity-50"
          >
            {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            {cuentas.length > 0 ? "Restablecer estándar" : "Cargar plan estándar Chile"}
          </button>
          <button
            onClick={() => openNew()}
            className="flex items-center gap-2 rounded-lg bg-sl-purple px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
          >
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {cuentas.length > 0 && (
        <div className="flex gap-4">
          {Object.entries(TIPOS).map(([tipo, info]) => {
            const count = cuentas.filter((c) => c.tipo === tipo && c.activo).length
            return (
              <div key={tipo} className="flex items-center gap-2 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", info.color)}>
                  {info.label}
                </span>
                <span className="text-sm font-medium text-sl-text">{count}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-2 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2">
            <BookOpen className="h-4 w-4 text-sl-muted" />
            <span className="text-sm font-medium text-sl-text">{conteoActivas} activas</span>
          </div>
        </div>
      )}

      {/* Árbol */}
      <div className="rounded-xl border border-sl-border bg-sl-bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sl-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : cuentas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <BookOpen className="h-8 w-8 text-sl-muted/40" />
            <p className="text-sm text-sl-muted">No hay cuentas registradas.</p>
            <button
              onClick={handleInicializar}
              disabled={initLoading}
              className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50"
            >
              {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Cargar plan estándar Chile
            </button>
          </div>
        ) : (
          <div className="py-2">
            {/* Cabecera */}
            <div className="flex items-center gap-2 border-b border-sl-border/50 px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-sl-muted">
              <span className="ml-8 w-20">Código</span>
              <span className="flex-1">Nombre</span>
              <span className="mr-20">Tipo</span>
            </div>
            <div className="pt-1">
              {tree.map((raiz) => (
                <CuentaNode
                  key={raiz.id}
                  cuenta={raiz}
                  level={0}
                  onAdd={openNew}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggleActivo={handleToggleActivo}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        title={editId ? "Editar cuenta" : "Nueva cuenta"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-sl-muted">Código *</label>
              <input
                type="text"
                placeholder="ej: 1.1.03"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder-sl-muted/50 focus:border-sl-purple focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-sl-muted">Tipo *</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none"
              >
                {Object.entries(TIPOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-sl-muted">Nombre *</label>
            <input
              type="text"
              placeholder="ej: Cuentas por Cobrar"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder-sl-muted/50 focus:border-sl-purple focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-sl-muted">Cuenta padre</label>
            <select
              value={form.cuentaPadreId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, cuentaPadreId: e.target.value || null }))}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none"
            >
              <option value="">— Sin padre (cuenta raíz) —</option>
              {todosParaPadre
                .filter((c) => c.id !== editId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-sl-muted">Subtipo (opcional)</label>
            <input
              type="text"
              placeholder="ej: circulante, fijo, operacional…"
              value={form.subtipo}
              onChange={(e) => setForm((f) => ({ ...f, subtipo: e.target.value }))}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder-sl-muted/50 focus:border-sl-purple focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.aceptaMovimientos}
              onChange={(e) => setForm((f) => ({ ...f, aceptaMovimientos: e.target.checked }))}
              className="h-4 w-4 rounded border-sl-border accent-sl-purple"
            />
            <span className="text-sm text-sl-text">Acepta movimientos contables</span>
            <span className="text-xs text-sl-muted">(desactivar si es solo agrupadora)</span>
          </label>

          {formError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? "Guardar cambios" : "Crear cuenta"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
