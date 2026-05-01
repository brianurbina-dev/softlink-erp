"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Pencil, Trash2, X, AlertTriangle, CheckCircle } from "lucide-react"
import { IVA_CHILE } from "@/lib/chile/impuestos"
import { cn } from "@/lib/utils"

interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  precio: number
  costo: number
  unidad: string
  afecto_iva: boolean
  stock_minimo: number
  activo: boolean
}

interface FormState {
  codigo: string
  nombre: string
  descripcion: string
  precio: string
  costo: string
  unidad: string
  afectoIva: boolean
  stockMinimo: string
}

const EMPTY: FormState = {
  codigo: "",
  nombre: "",
  descripcion: "",
  precio: "",
  costo: "",
  unidad: "UN",
  afectoIva: true,
  stockMinimo: "0",
}

const UNIDADES = ["UN", "KG", "LT", "MT", "M2", "M3", "HR", "DÍA", "MES", "CAJA", "PAQUETE", "OTRO"]

function fmtPrecio(n: number) {
  return `$${n.toLocaleString("es-CL")}`
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await fetch(q ? `/api/productos?search=${encodeURIComponent(q)}` : "/api/productos")
      const json = await res.json()
      if (res.ok) setProductos(json.data ?? [])
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

  function openEdit(p: Producto) {
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      precio: String(p.precio),
      costo: String(p.costo),
      unidad: p.unidad,
      afectoIva: p.afecto_iva,
      stockMinimo: String(p.stock_minimo),
    })
    setEditingId(p.id)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setEditingId(null)
  }

  async function save() {
    if (!form.codigo.trim()) return notify("El código es requerido", false)
    if (!form.nombre.trim()) return notify("El nombre es requerido", false)

    const precio = parseInt(form.precio || "0", 10)
    const costo = parseInt(form.costo || "0", 10)
    const stockMinimo = parseInt(form.stockMinimo || "0", 10)

    if (isNaN(precio) || precio < 0) return notify("El precio debe ser un número válido", false)
    if (isNaN(costo) || costo < 0) return notify("El costo debe ser un número válido", false)

    setSaving(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio,
        costo,
        unidad: form.unidad,
        afectoIva: form.afectoIva,
        stockMinimo: isNaN(stockMinimo) ? 0 : stockMinimo,
      }
      const url = modal === "edit" ? `/api/productos/${editingId}` : "/api/productos"
      const method = modal === "edit" ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify(modal === "edit" ? "Producto actualizado" : "Producto creado", true)
      closeModal()
      load(search)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al eliminar", false)
      notify("Producto eliminado", true)
      load(search)
    } finally {
      setDeletingId(null)
    }
  }

  const precioConIva = form.afectoIva && form.precio
    ? Math.round(parseInt(form.precio || "0", 10) * (1 + IVA_CHILE))
    : null

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Productos</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Catálogo de productos y servicios</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por código o nombre..."
          className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Nombre</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Precio</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Costo</th>
              <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Unidad</th>
              <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">IVA</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">Stock mín.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-sl-muted">Cargando...</td>
              </tr>
            ) : productos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-sl-muted">
                  {search ? "No se encontraron productos con esa búsqueda" : "No hay productos registrados aún"}
                </td>
              </tr>
            ) : (
              productos.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-sl-border/50 transition-colors last:border-0 hover:bg-sl-purple/[0.04]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-sl-muted">{p.codigo}</td>
                  <td className="px-4 py-3 font-medium text-sl-text">{p.nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sl-text">{fmtPrecio(p.precio)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted md:table-cell">{fmtPrecio(p.costo)}</td>
                  <td className="hidden px-4 py-3 text-center text-sl-muted md:table-cell">{p.unidad}</td>
                  <td className="hidden px-4 py-3 text-center lg:table-cell">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      p.afecto_iva
                        ? "bg-sl-success/[0.15] text-sl-success"
                        : "bg-sl-muted/[0.15] text-sl-muted"
                    )}>
                      {p.afecto_iva ? "19%" : "Exento"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted lg:table-cell">{p.stock_minimo}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-purple/[0.15] hover:text-sl-purple-light"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        disabled={deletingId === p.id}
                        className="rounded-md p-1.5 text-sl-muted transition-colors hover:bg-sl-danger/[0.15] hover:text-sl-danger disabled:opacity-40"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && productos.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {productos.length} producto{productos.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">
                {modal === "create" ? "Nuevo producto" : "Editar producto"}
              </h2>
              <button onClick={closeModal} className="text-sl-muted transition-colors hover:text-sl-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Código y Nombre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                    Código <span className="text-sl-danger">*</span>
                  </label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    placeholder="PROD-001"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                    Unidad
                  </label>
                  <select
                    value={form.unidad}
                    onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                  Nombre <span className="text-sl-danger">*</span>
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Descripción del producto o servicio"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles adicionales (opcional)"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>

              {/* Precio y Costo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Precio neto (CLP)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                  {precioConIva !== null && precioConIva > 0 && (
                    <p className="mt-1 text-xs text-sl-muted">
                      Con IVA: <span className="text-sl-text">{fmtPrecio(precioConIva)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Costo (CLP)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.costo}
                    onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                </div>
              </div>

              {/* IVA y Stock mínimo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockMinimo}
                    onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="mb-3 block text-xs font-medium text-sl-muted">IVA</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, afectoIva: !f.afectoIva }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      form.afectoIva
                        ? "border-sl-success/50 bg-sl-success/[0.08] text-sl-success"
                        : "border-sl-border bg-sl-bg-card text-sl-muted hover:text-sl-text"
                    )}
                  >
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      form.afectoIva ? "bg-sl-success" : "bg-sl-muted"
                    )} />
                    {form.afectoIva ? "Afecto IVA (19%)" : "Exento de IVA"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50"
              >
                {saving ? "Guardando..." : modal === "create" ? "Crear producto" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
            toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white"
          )}
        >
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
