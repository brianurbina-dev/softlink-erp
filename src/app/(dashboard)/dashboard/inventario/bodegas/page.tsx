"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, X, AlertTriangle, CheckCircle, Warehouse, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Bodega {
  id: string
  nombre: string
  descripcion: string | null
  activa: boolean
  creado_en: string
}

interface FormState {
  nombre: string
  descripcion: string
}

const EMPTY: FormState = { nombre: "", descripcion: "" }

export default function BodegasPage() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
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
      const res = await fetch("/api/bodegas")
      const json = await res.json()
      if (res.ok) setBodegas(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm(EMPTY)
    setEditingId(null)
    setModal("create")
  }

  function openEdit(b: Bodega) {
    setForm({ nombre: b.nombre, descripcion: b.descripcion ?? "" })
    setEditingId(b.id)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setEditingId(null)
  }

  async function save() {
    if (!form.nombre.trim()) return notify("El nombre es requerido", false)
    setSaving(true)
    try {
      const url = modal === "edit" ? `/api/bodegas/${editingId}` : "/api/bodegas"
      const method = modal === "edit" ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre.trim(), descripcion: form.descripcion.trim() }),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify(modal === "edit" ? "Bodega actualizada" : "Bodega creada", true)
      closeModal()
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActiva(b: Bodega) {
    const res = await fetch(`/api/bodegas/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !b.activa }),
    })
    const json = await res.json()
    if (!res.ok) return notify(json.error ?? "Error al actualizar", false)
    setBodegas((prev) => prev.map((x) => (x.id === b.id ? { ...x, activa: !b.activa } : x)))
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar esta bodega? Solo es posible si no tiene stock registrado.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/bodegas/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al eliminar", false)
      notify("Bodega eliminada", true)
      load()
    } finally {
      setDeletingId(null)
    }
  }

  const activas = bodegas.filter((b) => b.activa)
  const inactivas = bodegas.filter((b) => !b.activa)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Bodegas</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Gestión de ubicaciones de almacenamiento</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Nueva bodega
        </button>
      </div>

      {/* KPI rápido */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Total bodegas</p>
          <p className="mt-1 text-2xl font-semibold text-sl-text">{bodegas.length}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Activas</p>
          <p className="mt-1 text-2xl font-semibold text-sl-success">{activas.length}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Inactivas</p>
          <p className="mt-1 text-2xl font-semibold text-sl-muted">{inactivas.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Nombre</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Descripción</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-sl-muted">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : bodegas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <Warehouse className="mx-auto mb-3 h-10 w-10 text-sl-muted/40" />
                  <p className="text-sm text-sl-muted">No hay bodegas registradas</p>
                  <p className="mt-1 text-xs text-sl-muted/60">Crea la primera bodega para empezar a registrar stock</p>
                </td>
              </tr>
            ) : (
              bodegas.map((b) => (
                <tr key={b.id} className="border-b border-sl-border/50 last:border-0 hover:bg-sl-purple/[0.04]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 shrink-0 text-sl-purple/60" />
                      <span className="font-medium text-sl-text">{b.nombre}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-sl-muted md:table-cell">{b.descripcion || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiva(b)}
                      title={b.activa ? "Desactivar bodega" : "Activar bodega"}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
                      style={{
                        background: b.activa ? "rgba(29,158,117,0.15)" : "rgba(136,136,153,0.15)",
                        color: b.activa ? "#1D9E75" : "#888899",
                      }}
                    >
                      {b.activa ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      {b.activa ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => openEdit(b)} className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del(b.id)} disabled={deletingId === b.id} className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-danger/[0.15] hover:text-sl-danger disabled:opacity-40" title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && bodegas.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {bodegas.length} bodega{bodegas.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">{modal === "create" ? "Nueva bodega" : "Editar bodega"}</h2>
              <button onClick={closeModal} className="text-sl-muted transition-colors hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Nombre <span className="text-sl-danger">*</span></label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Bodega Principal"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ubicación o descripción adicional..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={closeModal} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text">Cancelar</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Guardando..." : modal === "create" ? "Crear bodega" : "Guardar cambios"}
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
