"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Save,
  Eye,
  Plus,
  Minus,
  Trash2,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
import { PdfModal } from "@/components/erp/PdfModal"
import type { ApiResponse } from "@/types"

interface Producto {
  id: string
  codigo: string
  nombre: string
  precio: number
  afecto_iva: boolean
}

interface CartItem {
  key: string
  productoId: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
}

function genKey() { return Math.random().toString(36).slice(2, 10) }
function fmtMonto(n: number) { return `$ ${n.toLocaleString("es-CL")}` }

export default function EditarBoletaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState("")
  const [receptorRut, setReceptorRut] = useState("")
  const [receptorNombre, setReceptorNombre] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [searchProd, setSearchProd] = useState("")
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
      fetch(`/api/boletas/${id}`).then((r) => r.json()) as Promise<ApiResponse<{
        fecha: string
        receptor_rut: string | null
        receptor_nombre: string | null
        items: { descripcion: string; cantidad: number; precio_unitario: number; producto_id: string | null }[]
      }>>,
      fetch("/api/productos").then((r) => r.json()) as Promise<ApiResponse<Producto[]>>,
    ]).then(([b, p]) => {
      if (b.data) {
        setFecha(String(b.data.fecha).split("T")[0])
        setReceptorRut(b.data.receptor_rut ?? "")
        setReceptorNombre(b.data.receptor_nombre ?? "")
        setCart((b.data.items ?? []).map((i) => ({
          key: genKey(),
          productoId: i.producto_id,
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
        })))
      }
      setProductos(p.data ?? [])
      setLoading(false)
    })
  }, [id])

  const filteredProductos = useMemo(() => {
    const q = searchProd.toLowerCase()
    if (!q) return productos
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    )
  }, [productos, searchProd])

  function addProduct(prod: Producto) {
    const exists = cart.find((c) => c.productoId === prod.id)
    if (exists) {
      setCart((prev) => prev.map((c) => c.key === exists.key ? { ...c, cantidad: c.cantidad + 1 } : c))
    } else {
      setCart((prev) => [...prev, {
        key: genKey(),
        productoId: prod.id,
        descripcion: prod.nombre,
        cantidad: 1,
        precioUnitario: prod.precio,
      }])
    }
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) => prev.map((c) => c.key === key ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c))
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key))
  }

  const neto = cart.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
  const iva = calcularIva(neto)
  const total = neto + iva

  function buildPayload() {
    return {
      fecha,
      receptorRut: receptorRut.trim() || null,
      receptorNombre: receptorNombre.trim() || null,
      items: cart.map((c) => ({
        productoId: c.productoId,
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precioUnitario: c.precioUnitario,
        descuento: 0,
      })),
    }
  }

  async function handlePrevisualizar() {
    setPreviewing(true)
    try {
      const res = await fetch(`/api/boletas/${id}/preview`)
      if (!res.ok) return notify("Error al generar vista previa", false)
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleGuardar() {
    if (cart.length === 0) return notify("Agrega al menos un producto", false)
    setSaving(true)
    try {
      const res = await fetch(`/api/boletas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify("Borrador guardado", true)
      router.push("/dashboard/facturacion/boletas")
    } finally {
      setSaving(false)
    }
  }

  async function handleEmitir() {
    if (cart.length === 0) return notify("Agrega al menos un producto", false)
    setEmitting(true)
    try {
      const res1 = await fetch(`/api/boletas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const j1 = await res1.json()
      if (!res1.ok) return notify(j1.error ?? "Error al guardar", false)

      const res2 = await fetch(`/api/boletas/${id}/emitir`, { method: "POST" })
      const j2 = await res2.json()
      if (!res2.ok) return notify(j2.error ?? "Error al emitir", false)
      notify(`Boleta emitida — Folio ${(j2.data as { folio: number }).folio}`, true)
      setTimeout(() => router.push("/dashboard/facturacion/boletas"), 1500)
    } finally {
      setEmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-sl-muted" />
      </div>
    )
  }

  const isSubmitting = saving || emitting

  return (
    <div className="flex gap-5">
      {/* Left: datos + productos */}
      <div className="flex-1 space-y-4">
        <Link
          href="/dashboard/facturacion/boletas"
          className="flex w-fit items-center gap-1.5 text-sm text-sl-muted transition-colors hover:text-sl-text"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Boletas
        </Link>

        <div>
          <h1 className="text-page-title text-sl-text">Editar Boleta</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Modificar borrador de boleta electrónica tipo 39</p>
        </div>

        {/* Receptor */}
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sl-muted">
            Receptor <span className="font-normal normal-case">(opcional)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-sl-muted">RUT receptor</label>
              <input
                value={receptorRut}
                onChange={(e) => setReceptorRut(e.target.value)}
                placeholder="12345678-9"
                className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-sl-muted">Nombre / razón social</label>
              <input
                value={receptorNombre}
                onChange={(e) => setReceptorNombre(e.target.value)}
                placeholder="Consumidor final si se deja en blanco"
                className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
            </div>
          </div>
          <div className="max-w-[200px]">
            <label className="mb-1 block text-xs text-sl-muted">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            />
          </div>
        </div>

        {/* Búsqueda de productos */}
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sl-muted">Agregar productos</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
            <input
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {filteredProductos.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="flex items-center justify-between rounded-lg border border-sl-border bg-sl-bg-dark/20 px-3 py-2 text-left text-xs transition-colors hover:border-sl-purple/50 hover:bg-sl-purple/[0.06]"
              >
                <span className="truncate text-sl-text">{p.nombre}</span>
                <span className="ml-2 shrink-0 font-mono tabular-nums text-sl-muted">
                  {fmtMonto(Math.round(p.precio * 1.19))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: carrito */}
      <div className="w-80 shrink-0">
        <div
          className="rounded-card border border-sl-border bg-sl-bg-card p-4 space-y-3"
          style={{ position: "sticky", top: "16px" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sl-muted">Carrito</h2>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-xs text-sl-muted">Sin productos</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-2 rounded-lg border border-sl-border/40 bg-sl-bg-dark/30 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-sl-text">{item.descripcion}</p>
                    <p className="text-xs text-sl-muted">{fmtMonto(item.precioUnitario)} c/u</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => updateQty(item.key, -1)}
                      className="rounded p-0.5 text-sl-muted transition-colors hover:text-sl-text"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs tabular-nums text-sl-text">{item.cantidad}</span>
                    <button
                      onClick={() => updateQty(item.key, 1)}
                      className="rounded p-0.5 text-sl-muted transition-colors hover:text-sl-text"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeItem(item.key)}
                      className="ml-1 rounded p-0.5 text-sl-muted transition-colors hover:text-sl-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="space-y-1 border-t border-sl-border/60 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-sl-muted">Neto</span>
                <span className="font-mono tabular-nums text-sl-text">{fmtMonto(neto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sl-muted">IVA (19%)</span>
                <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(iva)}</span>
              </div>
              <div className="flex justify-between border-t border-sl-border/60 pt-1 font-semibold">
                <span className="text-sl-text">Total</span>
                <span className="font-mono tabular-nums text-sl-text">{fmtMonto(total)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              onClick={handlePrevisualizar}
              disabled={previewing || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
            >
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Previsualizar PDF
            </button>
            <button
              onClick={handleGuardar}
              disabled={isSubmitting || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:border-sl-border/80 hover:text-sl-text disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              onClick={handleEmitir}
              disabled={isSubmitting || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50"
            >
              {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {emitting ? "Emitiendo..." : "Emitir Boleta"}
            </button>
          </div>
        </div>
      </div>

      {previewUrl && (
        <PdfModal
          url={previewUrl}
          titulo="Vista previa de boleta"
          isPreview
          onClose={() => {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
          }}
        />
      )}

      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
          toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white"
        )}>
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
