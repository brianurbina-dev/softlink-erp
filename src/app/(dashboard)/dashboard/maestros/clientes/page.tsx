"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Pencil, Trash2, Upload, X, AlertTriangle, CheckCircle } from "lucide-react"
import { formatRutDisplay, validarRut } from "@/lib/chile/rut"
import { RutInput } from "@/components/erp/RutInput"
import { cn } from "@/lib/utils"

interface Cliente {
  id: string
  rut: string
  razon_social: string
  giro: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  activo: boolean
}

interface FormState {
  rut: string
  razonSocial: string
  giro: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
}

const EMPTY: FormState = {
  rut: "",
  razonSocial: "",
  giro: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await fetch(q ? `/api/clientes?search=${encodeURIComponent(q)}` : "/api/clientes")
      const json = await res.json()
      if (res.ok) setClientes(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load(v), 350)
  }

  function openCreate() {
    setForm(EMPTY)
    setEditingId(null)
    setModal("create")
  }

  function openEdit(c: Cliente) {
    setForm({
      rut: formatRutDisplay(c.rut),
      razonSocial: c.razon_social,
      giro: c.giro ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      ciudad: c.ciudad ?? "",
    })
    setEditingId(c.id)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setEditingId(null)
  }

  async function save() {
    if (!validarRut(form.rut)) return notify("Ingresa un RUT válido", false)
    if (!form.razonSocial.trim()) return notify("La razón social es requerida", false)

    setSaving(true)
    try {
      const payload = {
        rut: form.rut,
        razonSocial: form.razonSocial.trim(),
        giro: form.giro.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
      }
      const url = modal === "edit" ? `/api/clientes/${editingId}` : "/api/clientes"
      const method = modal === "edit" ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify(modal === "edit" ? "Cliente actualizado" : "Cliente creado", true)
      closeModal()
      load(search)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al eliminar", false)
      notify("Cliente eliminado", true)
      load(search)
    } finally {
      setDeletingId(null)
    }
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ""

    const text = await file.text()
    const rows = text
      .split("\n")
      .map((r) => r.split(",").map((c) => c.trim().replace(/^["']|["']$/g, "")))

    const records = rows
      .slice(1)
      .filter((r) => r.length >= 2 && r[0])
      .map((r) => ({
        rut: r[0] ?? "",
        razonSocial: r[1] ?? "",
        giro: r[2] ?? "",
        email: r[3] ?? "",
        telefono: r[4] ?? "",
        direccion: r[5] ?? "",
        ciudad: r[6] ?? "",
      }))

    if (records.length === 0) return notify("El archivo no contiene registros válidos", false)

    const res = await fetch("/api/clientes/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records),
    })
    const json = await res.json()
    if (!res.ok) return notify(json.error ?? "Error al importar", false)
    const { importados, errores } = json.data
    notify(
      `${importados} cliente${importados !== 1 ? "s" : ""} importado${importados !== 1 ? "s" : ""}${errores.length > 0 ? ` (${errores.length} error${errores.length !== 1 ? "es" : ""})` : ""}`,
      errores.length === 0
    )
    load(search)
  }

  const field = (label: string, key: keyof FormState, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-sl-muted">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
        {...props}
      />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Clientes</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Gestión del catálogo de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            title="Importar desde CSV (columnas: rut, razon_social, giro, email, telefono, direccion, ciudad)"
            className="flex items-center gap-1.5 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCsv} />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por RUT o razón social..."
          className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
        />
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">RUT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Razón Social</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Giro</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">Email</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">Teléfono</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-sl-muted">
                  {search ? "No se encontraron clientes con esa búsqueda" : "No hay clientes registrados aún"}
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className="border-b border-sl-border/50 transition-colors last:border-0 hover:bg-sl-purple/[0.04]">
                  <td className="px-4 py-3 font-mono text-xs text-sl-muted">{formatRutDisplay(c.rut)}</td>
                  <td className="px-4 py-3 font-medium text-sl-text">{c.razon_social}</td>
                  <td className="hidden px-4 py-3 text-sl-muted md:table-cell">{c.giro || "—"}</td>
                  <td className="hidden px-4 py-3 text-sl-muted lg:table-cell">{c.email || "—"}</td>
                  <td className="hidden px-4 py-3 text-sl-muted lg:table-cell">{c.telefono || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del(c.id)} disabled={deletingId === c.id} className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-danger/[0.15] hover:text-sl-danger disabled:opacity-40" title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && clientes.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">{modal === "create" ? "Nuevo cliente" : "Editar cliente"}</h2>
              <button onClick={closeModal} className="text-sl-muted transition-colors hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">RUT <span className="text-sl-danger">*</span></label>
                <RutInput value={form.rut} onChange={(v) => setForm((f) => ({ ...f, rut: v }))} disabled={modal === "edit"} />
              </div>
              {field("Razón Social *", "razonSocial", { placeholder: "Empresa Ejemplo SpA" })}
              {field("Giro", "giro", { placeholder: "Venta al por menor de ropa" })}
              <div className="grid grid-cols-2 gap-3">
                {field("Email", "email", { type: "email", placeholder: "contacto@empresa.cl" })}
                {field("Teléfono", "telefono", { placeholder: "+56 9 1234 5678" })}
              </div>
              {field("Dirección", "direccion", { placeholder: "Av. Principal 123, Of. 1" })}
              {field("Ciudad", "ciudad", { placeholder: "Santiago" })}
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={closeModal} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text">Cancelar</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Guardando..." : modal === "create" ? "Crear cliente" : "Guardar cambios"}
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
