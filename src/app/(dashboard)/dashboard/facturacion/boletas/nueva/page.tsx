"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
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

function computeSubtotal(item: CartItem): number {
  return item.precioUnitario * item.cantidad
}

function fmtMonto(n: number): string {
  return `$ ${n.toLocaleString("es-CL")}`
}

export default function NuevaBoletaPage() {
  const router = useRouter()

  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [receptorRut, setReceptorRut] = useState("")
  const [receptorNombre, setReceptorNombre] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])

  const [productos, setProductos] = useState<Producto[]>([])
  const [searchProd, setSearchProd] = useState("")
  const [emitting, setEmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json() as Promise<ApiResponse<Producto[]>>)
      .then((j) => setProductos(j.data ?? []))
  }, [])

  const filteredProductos = useMemo(() => {
    const q = searchProd.toLowerCase()
    if (!q) return productos
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q)
    )
  }, [productos, searchProd])

  function addProduct(p: Producto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productoId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [
        ...prev,
        {
          key: p.id,
          productoId: p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precioUnitario: p.precio,
        },
      ]
    })
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0)
    )
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  const neto = cart.reduce((s, i) => s + computeSubtotal(i), 0)
  const iva = calcularIva(neto)
  const total = neto + iva

  function buildPayload() {
    return {
      fecha,
      receptorRut: receptorRut.trim() || null,
      receptorNombre: receptorNombre.trim() || null,
      items: cart.map((i) => ({
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento: 0,
      })),
    }
  }

  function validate(): string | null {
    if (cart.length === 0) return "Agrega al menos un producto"
    return null
  }

  async function handleGuardar() {
    const err = validate()
    if (err) return notify(err, false)

    setSaving(true)
    try {
      const res = await fetch("/api/boletas", {
        method: "POST",
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
    const err = validate()
    if (err) return notify(err, false)

    setEmitting(true)
    try {
      const res1 = await fetch("/api/boletas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const j1 = await res1.json()
      if (!res1.ok) return notify(j1.error ?? "Error al crear boleta", false)

      const boletaId = (j1.data as { id: string }).id

      const res2 = await fetch(`/api/boletas/${boletaId}/emitir`, { method: "POST" })
      const j2 = await res2.json()
      if (!res2.ok) {
        notify(j2.error ?? "Error al emitir al SII", false)
        return
      }

      notify(`Boleta emitida — Folio ${(j2.data as { folio: number }).folio}`, true)
      setTimeout(() => router.push("/dashboard/facturacion/boletas"), 1500)
    } finally {
      setEmitting(false)
    }
  }

  const isSubmitting = saving || emitting

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/facturacion/boletas"
            className="flex items-center gap-1.5 text-sm text-sl-muted transition-colors hover:text-sl-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-page-title text-sl-text">Nueva Boleta</h1>
            <p className="text-sm text-sl-muted">Selecciona productos y emite al instante</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-sl-muted">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text outline-none focus:border-sl-purple"
          />
        </div>
      </div>

      {/* Two-panel POS layout */}
      <div className="flex gap-4" style={{ minHeight: "calc(100vh - 14rem)" }}>

        {/* Left: Product catalog */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
            <input
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              placeholder="Buscar producto por nombre o código..."
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
          </div>

          {filteredProductos.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-card border border-sl-border bg-sl-bg-card">
              <p className="text-sm text-sl-muted">
                {productos.length === 0 ? "No hay productos registrados" : "Sin coincidencias"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-2 xl:grid-cols-4">
              {filteredProductos.map((p) => {
                const inCart = cart.find((i) => i.productoId === p.id)
                const publicPrice = Math.round(p.precio * 1.19)
                return (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className={cn(
                      "relative flex flex-col items-start rounded-card border p-3 text-left transition-colors hover:border-sl-purple/50 hover:bg-sl-purple/[0.05]",
                      inCart
                        ? "border-sl-purple/40 bg-sl-purple/[0.06]"
                        : "border-sl-border bg-sl-bg-card"
                    )}
                  >
                    {inCart && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-sl-purple text-[10px] font-bold text-white">
                        {inCart.cantidad}
                      </span>
                    )}
                    <p className="text-xs text-sl-muted">{p.codigo}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-medium text-sl-text">
                      {p.nombre}
                    </p>
                    <p className="mt-1.5 font-mono text-sm font-semibold text-sl-purple-light">
                      {fmtMonto(publicPrice)}
                    </p>
                    <p className="text-[10px] text-sl-muted">c/IVA</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Current boleta */}
        <div className="flex w-72 shrink-0 flex-col rounded-card border border-sl-border bg-sl-bg-card overflow-hidden">
          {/* Cart header */}
          <div className="flex items-center gap-2 border-b border-sl-border/60 px-4 py-3">
            <ShoppingCart className="h-4 w-4 text-sl-muted" />
            <span className="text-sm font-semibold text-sl-text">Boleta actual</span>
            {cart.length > 0 && (
              <span className="ml-auto rounded-full bg-sl-purple/20 px-2 py-0.5 text-xs text-sl-purple-light">
                {cart.length}
              </span>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-xs text-sl-muted">
                Haz clic en un producto para agregarlo
              </p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-2 rounded-lg border border-sl-border/40 bg-sl-bg-dark/30 p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-sl-text">{item.descripcion}</p>
                    <p className="font-mono text-xs text-sl-muted">
                      {fmtMonto(item.precioUnitario)} × {item.cantidad}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => changeQty(item.key, -1)}
                      className="flex h-5 w-5 items-center justify-center rounded border border-sl-border text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-text"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="w-5 text-center text-xs tabular-nums text-sl-text">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => changeQty(item.key, 1)}
                      className="flex h-5 w-5 items-center justify-center rounded border border-sl-border text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-text"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.key)}
                      className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-sl-muted transition-colors hover:text-sl-danger"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Receptor (optional) */}
          <div className="border-t border-sl-border/60 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-sl-muted">Receptor (opcional)</p>
            <input
              value={receptorRut}
              onChange={(e) => setReceptorRut(e.target.value)}
              placeholder="RUT"
              className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2.5 py-1.5 text-xs text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
            <input
              value={receptorNombre}
              onChange={(e) => setReceptorNombre(e.target.value)}
              placeholder="Nombre o razón social"
              className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2.5 py-1.5 text-xs text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
          </div>

          {/* Totals */}
          <div className="border-t border-sl-border/60 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-sl-muted">Neto</span>
              <span className="font-mono tabular-nums text-sl-text">{fmtMonto(neto)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-sl-muted">IVA (19%)</span>
              <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(iva)}</span>
            </div>
            <div className="flex justify-between border-t border-sl-border/60 pt-1.5 text-sm font-semibold">
              <span className="text-sl-text">Total</span>
              <span className="font-mono tabular-nums text-sl-text">{fmtMonto(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-sl-border/60 px-4 py-3 space-y-2">
            <button
              onClick={handleEmitir}
              disabled={isSubmitting || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sl-purple py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {emitting ? "Emitiendo..." : "Emitir Boleta"}
            </button>
            <button
              onClick={handleGuardar}
              disabled={isSubmitting || cart.length === 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sl-border py-2 text-xs text-sl-muted transition-colors hover:border-sl-border/80 hover:text-sl-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
            toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white"
          )}
        >
          {toast.ok ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
