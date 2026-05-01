"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

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

function emptyItem(): ItemForm {
  return {
    key: genKey(),
    productoId: "",
    descripcion: "",
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
  }
}

function computeSubtotal(item: ItemForm): number {
  const bruto = item.precioUnitario * item.cantidad
  return bruto - Math.round(bruto * (item.descuento / 100))
}

function fmtMonto(n: number): string {
  return `$ ${n.toLocaleString("es-CL")}`
}

const TIPOS_TRASLADO = [
  {
    value: 1 as const,
    label: "Venta (tipo 1)",
    desc: "Traslado por venta — aplica IVA 19%",
  },
  {
    value: 2 as const,
    label: "Traslado interno (tipo 2)",
    desc: "Traslado sin venta entre bodegas — sin IVA",
  },
  {
    value: 3 as const,
    label: "Consignación (tipo 3)",
    desc: "Consignación de mercadería — sin IVA",
  },
]

export default function NuevaGuiaPage() {
  const router = useRouter()

  const [tipoTraslado, setTipoTraslado] = useState<1 | 2 | 3>(1)
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [direccionDestino, setDireccionDestino] = useState("")
  const [transportistaRut, setTransportistaRut] = useState("")
  const [transportistaNombre, setTransportistaNombre] = useState("")
  const [patente, setPatente] = useState("")
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoMap, setProductoMap] = useState<Map<string, Producto>>(new Map())

  const [saving, setSaving] = useState(false)
  const [emitting, setEmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/clientes").then((r) => r.json()) as Promise<ApiResponse<Cliente[]>>,
      fetch("/api/productos").then((r) => r.json()) as Promise<ApiResponse<Producto[]>>,
    ]).then(([c, p]) => {
      setClientes(c.data ?? [])
      const prods = p.data ?? []
      setProductos(prods)
      setProductoMap(new Map(prods.map((pr) => [pr.id, pr])))
    })
  }, [])

  const neto = items.reduce((s, i) => s + computeSubtotal(i), 0)
  const iva = tipoTraslado === 1 ? calcularIva(neto) : 0
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
      tipoTraslado,
      clienteId: clienteId || null,
      fecha,
      direccionDestino: direccionDestino.trim() || null,
      transportistaRut: transportistaRut.trim() || null,
      transportistaNombre: transportistaNombre.trim() || null,
      patente: patente.trim() || null,
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
    if (!fecha) return "Ingresa la fecha"
    if (items.some((i) => !i.descripcion.trim())) return "Completa la descripción de todos los ítems"
    if (items.some((i) => i.cantidad < 1)) return "La cantidad debe ser al menos 1"
    if (items.some((i) => i.precioUnitario < 0)) return "El precio no puede ser negativo"
    return null
  }

  async function handleGuardar() {
    const err = validate()
    if (err) return notify(err, false)

    setSaving(true)
    try {
      const res = await fetch("/api/guias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)
      notify("Borrador guardado correctamente", true)
      router.push("/dashboard/facturacion/guias")
    } finally {
      setSaving(false)
    }
  }

  async function handleEmitir() {
    const err = validate()
    if (err) return notify(err, false)

    setEmitting(true)
    try {
      const res1 = await fetch("/api/guias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const j1 = await res1.json()
      if (!res1.ok) return notify(j1.error ?? "Error al crear guía", false)

      const guiaId = (j1.data as { id: string }).id

      const res2 = await fetch(`/api/guias/${guiaId}/emitir`, { method: "POST" })
      const j2 = await res2.json()
      if (!res2.ok) {
        notify(j2.error ?? "Error al emitir al SII", false)
        return
      }

      notify(`Guía emitida — Folio ${(j2.data as { folio: number }).folio}`, true)
      setTimeout(() => router.push("/dashboard/facturacion/guias"), 1500)
    } finally {
      setEmitting(false)
    }
  }

  const isSubmitting = saving || emitting

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/dashboard/facturacion/guias"
        className="flex w-fit items-center gap-1.5 text-sm text-sl-muted transition-colors hover:text-sl-text"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Guías
      </Link>

      <div>
        <h1 className="text-page-title text-sl-text">Nueva Guía de Despacho</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Documento tributario electrónico tipo 52</p>
      </div>

      {/* Tipo de traslado */}
      <div className="space-y-3 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Tipo de traslado</h2>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS_TRASLADO.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipoTraslado(t.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                tipoTraslado === t.value
                  ? "border-sl-purple bg-sl-purple/[0.08] text-sl-text"
                  : "border-sl-border text-sl-muted hover:border-sl-border/80 hover:text-sl-text"
              )}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="mt-0.5 text-xs text-sl-muted">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Datos generales */}
      <div className="space-y-4 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="text-sm font-semibold text-sl-text">Datos generales</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">
              Receptor{" "}
              {tipoTraslado !== 1 && (
                <span className="font-normal text-sl-muted/60">(opcional en traslado interno)</span>
              )}
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            >
              <option value="">— Sin receptor (traslado interno) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razon_social} ({c.rut})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">
              Fecha de emisión
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-sl-muted">
            Dirección de destino <span className="font-normal text-sl-muted/60">(opcional)</span>
          </label>
          <input
            type="text"
            value={direccionDestino}
            onChange={(e) => setDireccionDestino(e.target.value)}
            placeholder="Av. Ejemplo 1234, Santiago"
            className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
          />
        </div>
      </div>

      {/* Transporte */}
      <div className="space-y-4 rounded-card border border-sl-border bg-sl-bg-card p-5">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-sl-muted" />
          <h2 className="text-sm font-semibold text-sl-text">
            Datos de transporte{" "}
            <span className="text-xs font-normal text-sl-muted">(opcionales)</span>
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">RUT transportista</label>
            <input
              type="text"
              value={transportistaRut}
              onChange={(e) => setTransportistaRut(e.target.value)}
              placeholder="12345678-9"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Nombre transportista</label>
            <input
              type="text"
              value={transportistaNombre}
              onChange={(e) => setTransportistaNombre(e.target.value)}
              placeholder="Nombre o razón social"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">Patente vehículo</label>
            <input
              type="text"
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="AB-CD-12"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
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
                      onChange={(e) =>
                        updateItem(item.key, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-center text-xs text-sl-text outline-none focus:border-sl-purple"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={item.precioUnitario}
                      onChange={(e) =>
                        updateItem(item.key, { precioUnitario: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-full rounded-md border border-sl-border bg-sl-bg-dark/40 px-2 py-1.5 text-right font-mono text-xs text-sl-text outline-none focus:border-sl-purple"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.descuento}
                      onChange={(e) =>
                        updateItem(item.key, {
                          descuento: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
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
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
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
          {tipoTraslado === 1 && (
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
            {emitting ? "Emitiendo..." : "Emitir Guía"}
          </button>
        </div>
      </div>

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
