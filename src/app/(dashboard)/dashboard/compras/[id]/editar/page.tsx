"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle, XCircle, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

interface Proveedor { id: string; rut: string; razon_social: string }
interface Producto   { id: string; codigo: string; nombre: string; costo: number }
interface ItemForm   { key: string; productoId: string; descripcion: string; cantidad: number; precioUnitario: number }

function genKey() { return Math.random().toString(36).slice(2, 10) }
function emptyItem(): ItemForm { return { key: genKey(), productoId: "", descripcion: "", cantidad: 1, precioUnitario: 0 } }
function fmtMonto(n: number) { return `$ ${n.toLocaleString("es-CL")}` }

export default function EditarCompraPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [proveedorId, setProveedorId] = useState("")
  const [fecha, setFecha] = useState("")
  const [notas, setNotas] = useState("")
  const [estado, setEstado] = useState("borrador")
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoMap, setProductoMap] = useState<Map<string, Producto>>(new Map())

  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/proveedores").then((r) => r.json()) as Promise<ApiResponse<Proveedor[]>>,
      fetch("/api/productos").then((r) => r.json()) as Promise<ApiResponse<Producto[]>>,
      fetch(`/api/compras/${id}`).then((r) => r.json()),
    ]).then(([pvJson, prJson, compraJson]) => {
      setProveedores(pvJson.data ?? [])
      const prods = prJson.data ?? []
      setProductos(prods)
      setProductoMap(new Map(prods.map((p: Producto) => [p.id, p])))

      if (compraJson.data) {
        const c = compraJson.data
        setProveedorId(c.proveedor_id)
        setFecha(c.fecha.split("T")[0])
        setNotas(c.notas ?? "")
        setEstado(c.estado)
        setItems(
          (c.items ?? []).map((item: { producto_id: string | null; descripcion: string; cantidad: number; precio_unitario: number }) => ({
            key: genKey(),
            productoId: item.producto_id ?? "",
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precio_unitario,
          }))
        )
      }
      setLoaded(true)
    })
  }, [id])

  const neto = items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
  const iva = calcularIva(neto)
  const total = neto + iva

  function updateItem(key: string, changes: Partial<ItemForm>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)))
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev))
  }

  function onProductoSelect(key: string, productoId: string) {
    const prod = productoMap.get(productoId)
    if (prod) {
      updateItem(key, { productoId, descripcion: prod.nombre, precioUnitario: prod.costo })
    } else {
      updateItem(key, { productoId: "", descripcion: "", precioUnitario: 0 })
    }
  }

  function validate(): string | null {
    if (!proveedorId) return "Selecciona un proveedor"
    if (!fecha) return "Ingresa la fecha"
    if (items.some((i) => !i.descripcion.trim())) return "Completa la descripción de todos los ítems"
    if (items.some((i) => i.cantidad < 1)) return "La cantidad debe ser al menos 1"
    return null
  }

  async function handleGuardar(nuevoEstado?: string) {
    const err = validate()
    if (err) return notify(err, false)

    setSaving(true)
    try {
      const res = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId,
          fecha,
          notas,
          estado: nuevoEstado ?? estado,
          items: items.map((i) => ({
            productoId: i.productoId || null,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify("Cambios guardados", true)
      router.push("/dashboard/compras")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-sl-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/dashboard/compras" className="flex w-fit items-center gap-1.5 text-sm text-sl-muted hover:text-sl-text">
        <ArrowLeft className="h-4 w-4" /> Volver a Compras
      </Link>

      <div>
        <h1 className="text-page-title text-sl-text">Editar orden de compra</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Estado actual: <span className="capitalize">{estado}</span></p>
      </div>

      {/* Datos generales */}
      <div className="space-y-4 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Datos generales</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Proveedor</label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            >
              <option value="">— Selecciona proveedor —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.razon_social} ({p.rut})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-sl-muted">Notas internas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
          />
        </div>
      </div>

      {/* Ítems */}
      <div className="space-y-3 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Ítems de la compra</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-border/60">
                <th className="w-[180px] pb-2 pr-2 text-left text-xs font-medium text-sl-muted">Producto</th>
                <th className="pb-2 pr-2 text-left text-xs font-medium text-sl-muted">Descripción</th>
                <th className="w-16 pb-2 pr-2 text-center text-xs font-medium text-sl-muted">Cant.</th>
                <th className="w-28 pb-2 pr-2 text-right text-xs font-medium text-sl-muted">Costo unit.</th>
                <th className="w-28 pb-2 pr-2 text-right text-xs font-medium text-sl-muted">Subtotal</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.key} className="border-b border-sl-border/30 last:border-0">
                  <td className="py-2 pr-2">
                    <select
                      value={item.productoId}
                      onChange={(e) => onProductoSelect(item.key, e.target.value)}
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-xs text-sl-text outline-none focus:border-sl-purple"
                    >
                      <option value="">Sin producto</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => updateItem(item.key, { descripcion: e.target.value })}
                      placeholder={`Ítem ${idx + 1}`}
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-xs text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={(e) => updateItem(item.key, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-center text-xs text-sl-text outline-none focus:border-sl-purple"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={item.precioUnitario}
                      onChange={(e) => updateItem(item.key, { precioUnitario: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-right font-mono text-xs text-sl-text outline-none focus:border-sl-purple"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs tabular-nums text-sl-text">
                    {fmtMonto(item.precioUnitario * item.cantidad)}
                  </td>
                  <td className="py-2">
                    <button onClick={() => removeItem(item.key)} disabled={items.length === 1} className="rounded p-1 text-sl-muted hover:text-sl-danger disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setItems((prev) => [...prev, emptyItem()])} className="flex items-center gap-1.5 text-xs text-sl-muted hover:text-sl-text">
          <Plus className="h-3.5 w-3.5" /> Agregar ítem
        </button>
      </div>

      {/* Totales + Acciones */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[200px] space-y-1.5 rounded-card border border-sl-border bg-sl-bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-sl-muted">Neto</span>
            <span className="font-mono tabular-nums text-sl-text">{fmtMonto(neto)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-sl-muted">IVA (19%)</span>
            <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(iva)}</span>
          </div>
          <div className="flex justify-between border-t border-sl-border/60 pt-1.5 text-sm font-semibold">
            <span className="text-sl-text">Total</span>
            <span className="font-mono tabular-nums text-sl-text">{fmtMonto(total)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleGuardar()} disabled={saving} className="flex items-center gap-2 rounded-lg border border-sl-border px-4 py-2.5 text-sm text-sl-muted hover:text-sl-text disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          {estado === "borrador" && (
            <button onClick={() => handleGuardar("ordenada")} disabled={saving} className="flex items-center gap-2 rounded-lg bg-sl-purple px-5 py-2.5 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
              Guardar y ordenar
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl", toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white")}>
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
