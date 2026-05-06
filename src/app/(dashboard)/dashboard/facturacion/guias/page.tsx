"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Plus,
  Loader2,
  CheckCircle,
  Clock,
  FileText,
  Download,
  Zap,
  Receipt,
  Truck,
  XCircle,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"

interface GuiaRow {
  id: string
  folio: number | null
  fecha: string
  tipo_traslado: number
  cliente_rut: string | null
  cliente_razon_social: string | null
  neto: number
  iva: number
  total: number
  estado: string
  factura_id: string | null
  ref_factura_id: string | null
  ref_tipo: number | null
  ref_folio: number | null
  pdf_url: string | null
  creado_en: string
}

const TIPO_TRASLADO: Record<number, { label: string; color: string }> = {
  1: { label: "Venta", color: "text-sl-purple-light bg-sl-purple/[0.12]" },
  2: { label: "Traslado", color: "text-sl-warning bg-sl-warning/[0.12]" },
  3: { label: "Consignación", color: "text-sl-muted bg-sl-border/40" },
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador: { label: "Borrador", color: "text-sl-warning bg-sl-warning/[0.12]", icon: <Clock className="h-3 w-3" /> },
  emitida: { label: "Emitida", color: "text-sl-success bg-sl-success/[0.12]", icon: <CheckCircle className="h-3 w-3" /> },
  facturada: { label: "Facturada", color: "text-sl-purple-light bg-sl-purple/[0.12]", icon: <Receipt className="h-3 w-3" /> },
}

function fmtMonto(n: number): string {
  return `$ ${Number(n).toLocaleString("es-CL")}`
}

function fmtFecha(s: string): string {
  const iso = String(s).split("T")[0]
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default function GuiasPage() {
  const [guias, setGuias] = useState<GuiaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [facturando, setFacturando] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchGuias = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/guias")
    const json = (await res.json()) as ApiResponse<GuiaRow[]>
    setGuias(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGuias() }, [fetchGuias])

  async function handleEmitir(id: string) {
    setEmitiendo(id)
    try {
      const res = await fetch(`/api/guias/${id}/emitir`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al emitir", false)
      notify(`Guía emitida — Folio ${(json.data as { folio: number }).folio}`, true)
      fetchGuias()
    } finally {
      setEmitiendo(null)
    }
  }

  async function handleFacturar(id: string, folio: number | null) {
    if (!confirm(`¿Facturar la Guía ${folio ? `#${folio}` : ""}? Se creará una factura borrador.`)) return
    setFacturando(id)
    try {
      const res = await fetch(`/api/guias/${id}/facturar`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al facturar", false)
      notify("Factura borrador creada — revísala en Facturas para emitirla", true)
      fetchGuias()
    } finally {
      setFacturando(null)
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este borrador?")) return
    const res = await fetch(`/api/guias/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const j = await res.json()
      return notify(j.error ?? "Error al eliminar", false)
    }
    notify("Borrador eliminado", true)
    setGuias((prev) => prev.filter((g) => g.id !== id))
  }

  const emitidas = guias.filter((g) => g.estado === "emitida").length
  const facturadas = guias.filter((g) => g.estado === "facturada").length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Guías de Despacho</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Documentos tributarios electrónicos tipo 52</p>
        </div>
        <Link
          href="/dashboard/facturacion/guias/nueva"
          className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" /> Nueva Guía
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: guias.length, color: "text-sl-text" },
          { label: "Borradores", value: guias.filter((g) => g.estado === "borrador").length, color: "text-sl-warning" },
          { label: "Emitidas", value: emitidas, color: "text-sl-success" },
          { label: "Facturadas", value: facturadas, color: "text-sl-purple-light" },
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
        ) : guias.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Truck className="h-8 w-8 text-sl-border" />
            <p className="text-sm text-sl-muted">No hay guías de despacho</p>
            <Link
              href="/dashboard/facturacion/guias/nueva"
              className="mt-1 text-xs text-sl-purple transition-colors hover:text-sl-purple-light"
            >
              Crear primera guía
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-border/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Folio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Receptor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sl-muted">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {guias.map((g) => {
                  const est = ESTADO_CONFIG[g.estado] ?? ESTADO_CONFIG.borrador
                  const tipoInfo = TIPO_TRASLADO[g.tipo_traslado] ?? TIPO_TRASLADO[1]
                  const tieneRefFactura = !!g.ref_factura_id && !!g.ref_folio
                  return (
                    <tr key={g.id} className="border-b border-sl-border/40 last:border-0 transition-colors hover:bg-sl-border/10">
                      <td className="px-4 py-3 font-mono text-sl-text">
                        {g.folio ? `#${g.folio}` : <span className="text-sl-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tipoInfo.color)}>
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sl-text">{fmtFecha(g.fecha)}</td>
                      <td className="px-4 py-3">
                        {g.cliente_razon_social ? (
                          <>
                            <p className="max-w-[180px] truncate text-sl-text">{g.cliente_razon_social}</p>
                            <p className="text-xs text-sl-muted">{g.cliente_rut}</p>
                          </>
                        ) : (
                          <span className="text-xs text-sl-muted">Traslado interno</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-sl-text">
                        {fmtMonto(g.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", est.color)}>
                            {est.icon} {est.label}
                          </span>
                          {tieneRefFactura && (
                            <p className="text-xs text-sl-muted">
                              Ref. Fact. #{g.ref_folio}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {g.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => handleEmitir(g.id)}
                                disabled={emitiendo === g.id}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                              >
                                {emitiendo === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                Emitir
                              </button>
                              <button
                                onClick={() => handleEliminar(g.id)}
                                className="rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-danger/50 hover:text-sl-danger"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                          {g.estado === "emitida" && (
                            <>
                              {tieneRefFactura ? (
                                <Link
                                  href="/dashboard/facturacion/facturas"
                                  className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                  title={`Ver Factura #${g.ref_folio}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Factura #{g.ref_folio}
                                </Link>
                              ) : (
                                <button
                                  onClick={() => handleFacturar(g.id, g.folio)}
                                  disabled={facturando === g.id}
                                  className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                                >
                                  {facturando === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                                  Facturar
                                </button>
                              )}
                              {g.pdf_url && (
                                <a
                                  href={g.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                >
                                  <Download className="h-3 w-3" /> PDF
                                </a>
                              )}
                            </>
                          )}
                          {g.estado === "facturada" && g.pdf_url && (
                            <a
                              href={g.pdf_url}
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
