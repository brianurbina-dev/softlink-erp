"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Zap,
  X,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calcularIva } from "@/lib/chile/impuestos"
import type { ApiResponse } from "@/types"

interface NotaRow {
  id: string
  tipo: number
  folio: number | null
  fecha: string
  cliente_rut: string
  cliente_razon_social: string
  referencia_tipo: number | null
  referencia_folio: number | null
  referencia_razon: string | null
  neto: number
  iva: number
  total: number
  estado: string
  track_id: string | null
  pdf_url: string | null
}

interface FacturaEmitida {
  id: string
  tipo: number
  folio: number
  cliente_id: string
  cliente_razon_social: string
  cliente_rut: string
  neto: number
  iva: number
  total: number
}

interface FacturaItem {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Cliente {
  id: string
  rut: string
  razon_social: string
}

interface ItemForm {
  key: string
  descripcion: string
  cantidad: number
  precioUnitario: number
}

const TIPO_LABEL: Record<number, string> = {
  56: "Nota de Débito",
  61: "Nota de Crédito",
}

const TIPO_SHORT: Record<number, string> = {
  56: "ND",
  61: "NC",
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador: {
    label: "Borrador",
    color: "text-sl-warning bg-sl-warning/[0.12]",
    icon: <Clock className="h-3 w-3" />,
  },
  emitida: {
    label: "Emitida",
    color: "text-sl-success bg-sl-success/[0.12]",
    icon: <CheckCircle className="h-3 w-3" />,
  },
}

function fmtMonto(n: number): string {
  return `$ ${Number(n).toLocaleString("es-CL")}`
}

function fmtFecha(s: string): string {
  const iso = String(s).split("T")[0]
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function genKey() {
  return Math.random().toString(36).slice(2, 10)
}

export default function NotasPage() {
  const [notas, setNotas] = useState<NotaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [tipoNota, setTipoNota] = useState<56 | 61>(61)
  const [facturasEmitidas, setFacturasEmitidas] = useState<FacturaEmitida[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [refFacturaId, setRefFacturaId] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [razon, setRazon] = useState("")
  const [items, setItems] = useState<ItemForm[]>([])
  const [submitting, setSubmitting] = useState(false)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchNotas = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/notas")
    const json = (await res.json()) as ApiResponse<NotaRow[]>
    setNotas(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotas() }, [fetchNotas])

  async function openModal(tipo: 56 | 61) {
    setTipoNota(tipo)
    setRefFacturaId("")
    setClienteId("")
    setRazon(tipo === 61 ? "Corrección de documento" : "Cargo adicional")
    setItems([])
    setShowModal(true)

    const [f, c] = await Promise.all([
      fetch("/api/facturas?estado=emitida").then((r) => r.json()) as Promise<ApiResponse<FacturaEmitida[]>>,
      fetch("/api/clientes").then((r) => r.json()) as Promise<ApiResponse<Cliente[]>>,
    ])
    setFacturasEmitidas(f.data?.filter((x) => x.folio) ?? [])
    setClientes(c.data ?? [])
  }

  async function onRefFacturaChange(id: string) {
    setRefFacturaId(id)
    if (!id) { setItems([]); setClienteId(""); return }
    const ref = facturasEmitidas.find((f) => f.id === id)
    if (ref) setClienteId(ref.cliente_id)

    // Prefill items from reference factura
    const res = await fetch(`/api/facturas/${id}`)
    const json = await res.json() as ApiResponse<{ items: FacturaItem[] }>
    const refItems = json.data?.items ?? []
    setItems(
      refItems.map((i) => ({
        key: genKey(),
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
      }))
    )
  }

  function updateItem(key: string, changes: Partial<ItemForm>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)))
  }

  const neto = items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
  const refFactura = facturasEmitidas.find((f) => f.id === refFacturaId)
  const iva = refFactura?.tipo === 33 ? calcularIva(neto) : 0
  const total = neto + iva

  async function handleSubmit(emitir: boolean) {
    if (!refFacturaId) return notify("Selecciona la factura de referencia", false)
    if (!clienteId) return notify("Sin cliente asociado", false)
    if (!razon.trim()) return notify("Ingresa la razón", false)
    if (items.length === 0) return notify("Sin ítems", false)

    setSubmitting(true)
    try {
      const payload = {
        tipo: tipoNota,
        clienteId,
        fecha,
        referenciaTipo: refFactura?.tipo ?? 33,
        referenciaFolio: refFactura?.folio ?? 0,
        referenciaRazon: razon,
        emitir,
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuento: 0,
        })),
      }

      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok && res.status !== 201) {
        return notify(json.error ?? "Error al crear nota", false)
      }

      notify(
        emitir
          ? `${TIPO_LABEL[tipoNota]} emitida — Folio ${(json.data as { folio?: number }).folio ?? "pendiente"}`
          : `${TIPO_LABEL[tipoNota]} guardada como borrador`,
        true
      )
      setShowModal(false)
      fetchNotas()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEmitir(id: string) {
    setEmitiendo(id)
    try {
      const res = await fetch(`/api/notas/${id}/emitir`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al emitir", false)
      notify(`Nota emitida — Folio ${(json.data as { folio: number }).folio}`, true)
      fetchNotas()
    } finally {
      setEmitiendo(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Notas de Crédito y Débito</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Documentos de ajuste tipos 61 (NC) y 56 (ND)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal(61)}
            className="flex items-center gap-2 rounded-lg border border-sl-border px-4 py-2.5 text-sm text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-text"
          >
            <Plus className="h-4 w-4" /> Nota de Crédito
          </button>
          <button
            onClick={() => openModal(56)}
            className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
          >
            <Plus className="h-4 w-4" /> Nota de Débito
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: notas.length, color: "text-sl-text" },
          { label: "NC (tipo 61)", value: notas.filter((n) => n.tipo === 61).length, color: "text-sl-success" },
          { label: "ND (tipo 56)", value: notas.filter((n) => n.tipo === 56).length, color: "text-sl-warning" },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
            <p className="text-xs text-sl-muted">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-sl-muted" />
          </div>
        ) : notas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <p className="text-sm text-sl-muted">No hay notas de crédito/débito</p>
            <p className="text-xs text-sl-muted">Se crean automáticamente al anular una factura, o de forma manual</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-border/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Folio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Ref.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sl-muted">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {notas.map((n) => {
                  const est = ESTADO_CONFIG[n.estado] ?? ESTADO_CONFIG.borrador
                  return (
                    <tr key={n.id} className="border-b border-sl-border/40 last:border-0 transition-colors hover:bg-sl-border/10">
                      <td className="px-4 py-3 font-mono text-sl-text">
                        {n.folio ? `#${n.folio}` : <span className="text-sl-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          n.tipo === 61
                            ? "bg-sl-success/[0.12] text-sl-success"
                            : "bg-sl-warning/[0.12] text-sl-warning"
                        )}>
                          {TIPO_SHORT[n.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sl-text">{fmtFecha(n.fecha)}</td>
                      <td className="px-4 py-3">
                        <p className="max-w-[160px] truncate text-sl-text">{n.cliente_razon_social}</p>
                        <p className="text-xs text-sl-muted">{n.cliente_rut}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-sl-muted">
                        {n.referencia_folio ? (
                          <span>
                            Tipo {n.referencia_tipo} / #{n.referencia_folio}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-sl-text">
                        {fmtMonto(n.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          est.color
                        )}>
                          {est.icon} {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {n.estado === "borrador" && (
                            <button
                              onClick={() => handleEmitir(n.id)}
                              disabled={emitiendo === n.id}
                              className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                            >
                              {emitiendo === n.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              Emitir
                            </button>
                          )}
                          {n.estado === "emitida" && n.pdf_url && (
                            <a
                              href={n.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nueva Nota */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-sl-border bg-sl-bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-sl-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold text-sl-text">
                Nueva {TIPO_LABEL[tipoNota]}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-sl-muted transition-colors hover:text-sl-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* Referencia y fecha */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                    Factura de referencia
                  </label>
                  <select
                    value={refFacturaId}
                    onChange={(e) => onRefFacturaChange(e.target.value)}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    <option value="">— Selecciona factura —</option>
                    {facturasEmitidas.map((f) => (
                      <option key={f.id} value={f.id}>
                        #{f.folio} — {f.cliente_razon_social} — {fmtMonto(f.total)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  />
                </div>
              </div>

              {/* Razón */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-sl-muted">Razón</label>
                <input
                  type="text"
                  value={razon}
                  onChange={(e) => setRazon(e.target.value)}
                  placeholder="Motivo de la nota..."
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                />
              </div>

              {/* Items */}
              {items.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">
                    Ítems (prefilled desde referencia)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {items.map((item) => (
                      <div key={item.key} className="flex items-center gap-2 rounded-lg border border-sl-border/40 bg-sl-bg-dark/30 px-3 py-2">
                        <span className="flex-1 text-xs text-sl-text truncate">{item.descripcion}</span>
                        <input
                          type="number"
                          min={1}
                          value={item.cantidad}
                          onChange={(e) => updateItem(item.key, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-14 rounded border border-sl-border bg-sl-bg-card px-1.5 py-0.5 text-center text-xs text-sl-text outline-none focus:border-sl-purple"
                        />
                        <span className="w-24 text-right font-mono text-xs tabular-nums text-sl-muted">
                          {fmtMonto(item.precioUnitario * item.cantidad)}
                        </span>
                        <button
                          onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}
                          className="text-sl-muted transition-colors hover:text-sl-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="flex justify-end">
                  <div className="space-y-1 text-right">
                    <div className="flex gap-8 text-xs">
                      <span className="text-sl-muted">Neto</span>
                      <span className="font-mono tabular-nums text-sl-text">{fmtMonto(neto)}</span>
                    </div>
                    {iva > 0 && (
                      <div className="flex gap-8 text-xs">
                        <span className="text-sl-muted">IVA (19%)</span>
                        <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(iva)}</span>
                      </div>
                    )}
                    <div className="flex gap-8 border-t border-sl-border/60 pt-1 text-sm font-semibold">
                      <span className="text-sl-text">Total</span>
                      <span className="font-mono tabular-nums text-sl-text">{fmtMonto(total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-sl-border/60 px-5 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:border-sl-border/80 hover:text-sl-text disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar borrador"}
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-sl-purple px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Emitir ahora
              </button>
            </div>
          </div>
        </div>
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
