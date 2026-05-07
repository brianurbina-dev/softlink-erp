"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Save,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"
import { PdfModal } from "@/components/erp/PdfModal"

interface Cliente {
  id: string
  rut: string
  razon_social: string
}

interface Producto {
  id: string
  codigo: string
  nombre: string
  precio: number
  afecto_iva: boolean
}

interface ItemForm {
  key: string
  productoId: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
}

function genKey(): string {
  return Math.random().toString(36).slice(2, 10)
}

function computeSubtotal(item: ItemForm): number {
  const bruto = item.precioUnitario * item.cantidad
  return bruto - Math.round(bruto * (item.descuento / 100))
}

function fmtMonto(n: number): string {
  return `$ ${n.toLocaleString("es-CL")}`
}

export default function EditarFacturaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const facturaId = params.id

  const [tipo, setTipo] = useState<33 | 34>(33)
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState("")
  const [items, setItems] = useState<ItemForm[]>([])

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoMap, setProductoMap] = useState<Map<string, Producto>>(new Map())

  const [loadingInit, setLoadingInit] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emitting, setEmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/facturas/${facturaId}`).then((r) => r.json()) as Promise<ApiResponse<Record<string, unknown> & { items: { producto_id: string | null; descripcion: string; cantidad: number; precio_unitario: number; descuento: number }[] }>>,
      fetch("/api/clientes").then((r) => r.json()) as Promise<ApiResponse<Cliente[]>>,
      fetch("/api/productos").then((r) => r.json()) as Promise<ApiResponse<Producto[]>>,
    ]).then(([f, c, p]) => {
      const factura = f.data
      if (!factura) { router.push("/dashboard/facturacion/facturas"); return }

      setTipo((factura.tipo as number) === 34 ? 34 : 33)
      setClienteId(factura.cliente_id as string)
      setFecha(String(factura.fecha).split("T")[0])
      setItems(
        factura.items.map((i) => ({
          key: genKey(),
          productoId: i.producto_id ?? "",
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precio_unitario,
          descuento: i.descuento,
        }))
      )

      const prods = p.data ?? []
      setClientes(c.data ?? [])
      setProductos(prods)
      setProductoMap(new Map(prods.map((pr) => [pr.id, pr])))
      setLoadingInit(false)
    })
  }, [facturaId, router])

  const neto = items.reduce((s, i) => s + computeSubtotal(i), 0)
  const iva = tipo === 33 ? calcularIva(neto) : 0
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
      updateItem(key, { productoId, descripcion: prod.nombre, precioUnitario: prod.precio })
    } else {
      updateItem(key, { productoId, descripcion: "", precioUnitario: 0 })
    }
  }

  function buildPayload() {
    return {
      tipo,
      clienteId,
      fecha,
      items: items.map((i) => ({
        productoId: i.productoId || null,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento: i.descuento,
      })),
    }
  }

  function validate(): string | null {
    if (!clienteId) return "Selecciona un cliente"
    if (!fecha) return "Ingresa la fecha de emisión"
    if (items.some((i) => !i.descripcion.trim())) return "Completa la descripción de todos los ítems"
    if (items.some((i) => i.cantidad < 1)) return "La cantidad debe ser al menos 1 en todos los ítems"
    if (items.some((i) => i.precioUnitario < 0)) return "El precio no puede ser negativo"
    return null
  }

  async function handlePrevisualizar() {
    const err = validate()
    if (err) return notify(err, false)

    setPreviewing(true)
    try {
      const res = await fetch("/api/facturas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const txt = await res.text()
        return notify(txt || "Error al generar vista previa", false)
      }
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleGuardar() {
    const err = validate()
    if (err) return notify(err, false)

    setSaving(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify("Borrador guardado correctamente", true)
      router.push("/dashboard/facturacion/facturas")
    } finally {
      setSaving(false)
    }
  }

  async function handleEmitir() {
    const err = validate()
    if (err) return notify(err, false)

    setEmitting(true)
    try {
      // Save current state first
      const res1 = await fetch(`/api/facturas/${facturaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const j1 = await res1.json()
      if (!res1.ok) return notify(j1.error ?? "Error al guardar antes de emitir", false)

      const res2 = await fetch(`/api/facturas/${facturaId}/emitir`, { method: "POST" })
      const j2 = await res2.json()
      if (!res2.ok) return notify(j2.error ?? "Error al emitir al SII", false)

      notify(`Factura emitida — Folio ${(j2.data as { folio: number }).folio}`, true)
      setTimeout(() => router.push("/dashboard/facturacion/facturas"), 1500)
    } finally {
      setEmitting(false)
    }
  }

  const isSubmitting = saving || emitting || previewing

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-sl-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/dashboard/facturacion/facturas"
        className="flex w-fit items-center gap-1.5 text-sm text-sl-muted transition-colors hover:text-sl-text"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Facturas
      </Link>

      <div>
        <h1 className="text-page-title text-sl-text">Editar Factura</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Borrador — los cambios no se envían al SII hasta emitir</p>
      </div>

      {/* Datos generales */}
      <div className="space-y-4 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Datos generales</h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-sl-muted">Tipo de documento</label>
          <div className="grid grid-cols-2 gap-2">
            {([33, 34] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  tipo === t
                    ? "border-sl-purple bg-sl-purple/[0.08] text-sl-text"
                    : "border-sl-border text-sl-muted hover:border-sl-border/80 hover:text-sl-text"
                )}
              >
                <p className="text-sm font-medium">
                  {t === 33 ? "Factura Afecta (33)" : "Factura Exenta (34)"}
                </p>
                <p className="mt-0.5 text-xs text-sl-muted">
                  {t === 33 ? "Con IVA 19% — ventas gravadas" : "Sin IVA — servicios o bienes exentos"}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            >
              <option value="">— Selecciona cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razon_social} ({c.rut})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Fecha de emisión</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            />
          </div>
        </div>
      </div>

      {/* Ítems */}
      <div className="space-y-3 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Detalle de ítems</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-border/60">
                <th className="w-[190px] pb-2 pr-2 text-left text-xs font-medium text-sl-muted">Producto</th>
                <th className="pb-2 pr-2 text-left text-xs font-medium text-sl-muted">Descripción</th>
                <th className="w-16 pb-2 pr-2 text-center text-xs font-medium text-sl-muted">Cant.</th>
                <th className="w-28 pb-2 pr-2 text-right text-xs font-medium text-sl-muted">Precio unit.</th>
                <th className="w-20 pb-2 pr-2 text-center text-xs font-medium text-sl-muted">Desc. %</th>
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
                        <option key={p.id} value={p.id}>
                          {p.codigo} — {p.nombre}
                        </option>
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
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.descuento}
                      onChange={(e) => updateItem(item.key, { descuento: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-center text-xs text-sl-text outline-none focus:border-sl-purple"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs tabular-nums text-sl-text">
                    {fmtMonto(computeSubtotal(item))}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => removeItem(item.key)}
                      disabled={items.length === 1}
                      className="rounded p-1 text-sl-muted transition-colors hover:text-sl-danger disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => setItems((prev) => [...prev, { key: genKey(), productoId: "", descripcion: "", cantidad: 1, precioUnitario: 0, descuento: 0 }])}
          className="flex items-center gap-1.5 text-xs text-sl-muted transition-colors hover:text-sl-text"
        >
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
          {tipo === 33 && (
            <div className="flex justify-between text-sm">
              <span className="text-sl-muted">IVA (19%)</span>
              <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(iva)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-sl-border/60 pt-1.5 text-sm font-semibold">
            <span className="text-sl-text">Total</span>
            <span className="font-mono tabular-nums text-sl-text">{fmtMonto(total)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevisualizar}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg border border-sl-border px-4 py-2.5 text-sm text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {previewing ? "Generando..." : "Previsualizar PDF"}
          </button>
          <button
            onClick={handleGuardar}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg border border-sl-border px-4 py-2.5 text-sm text-sl-muted transition-colors hover:border-sl-border/80 hover:text-sl-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            onClick={handleEmitir}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-sl-purple px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {emitting ? "Emitiendo..." : "Emitir DTE"}
          </button>
        </div>
      </div>

      {previewUrl && (
        <PdfModal
          url={previewUrl}
          titulo="Vista previa del documento"
          isPreview
          onClose={() => {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
          }}
        />
      )}

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
            toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white"
          )}
        >
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
