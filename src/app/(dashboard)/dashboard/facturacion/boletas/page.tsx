"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Loader2,
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Zap,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"
import { PdfModal } from "@/components/erp/PdfModal"

interface BoletaRow {
  id: string
  folio: number | null
  fecha: string
  receptor_rut: string | null
  receptor_nombre: string | null
  neto: number
  iva: number
  total: number
  estado: string
  track_id: string | null
  pdf_url: string | null
  creado_en: string
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
  anulada: {
    label: "Anulada",
    color: "text-sl-danger bg-sl-danger/[0.12]",
    icon: <XCircle className="h-3 w-3" />,
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

export default function BoletasPage() {
  const [boletas, setBoletas] = useState<BoletaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [pdfModal, setPdfModal] = useState<{ url: string; folio: number } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchBoletas = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    if (filtroEstado) p.set("estado", filtroEstado)
    const res = await fetch(`/api/boletas?${p}`)
    const json = (await res.json()) as ApiResponse<BoletaRow[]>
    setBoletas(json.data ?? [])
    setLoading(false)
  }, [search, filtroEstado])

  useEffect(() => { fetchBoletas() }, [fetchBoletas])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  async function handleEmitir(id: string) {
    setEmitiendo(id)
    try {
      const res = await fetch(`/api/boletas/${id}/emitir`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al emitir", false)
      notify(`Boleta emitida — Folio ${(json.data as { folio: number }).folio}`, true)
      fetchBoletas()
    } finally {
      setEmitiendo(null)
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este borrador?")) return
    const res = await fetch(`/api/boletas/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const j = await res.json()
      return notify(j.error ?? "Error al eliminar", false)
    }
    notify("Borrador eliminado", true)
    setBoletas((prev) => prev.filter((b) => b.id !== id))
  }

  const borradores = boletas.filter((b) => b.estado === "borrador").length
  const emitidas = boletas.filter((b) => b.estado === "emitida").length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Boletas</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Documentos tributarios electrónicos tipo 39</p>
        </div>
        <Link
          href="/dashboard/facturacion/boletas/nueva"
          className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" /> Nueva Boleta
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: boletas.length, color: "text-sl-text" },
          { label: "Borradores", value: borradores, color: "text-sl-warning" },
          { label: "Emitidas", value: emitidas, color: "text-sl-success" },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
            <p className="text-xs text-sl-muted">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por receptor o folio..."
            className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-sl-border bg-sl-bg-card p-1">
          {[
            { value: "", label: "Todos" },
            { value: "borrador", label: "Borradores" },
            { value: "emitida", label: "Emitidas" },
            { value: "anulada", label: "Anuladas" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroEstado(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filtroEstado === f.value
                  ? "bg-sl-purple/20 text-sl-purple-light"
                  : "text-sl-muted hover:text-sl-text"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-sl-muted" />
          </div>
        ) : boletas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Receipt className="h-8 w-8 text-sl-border" />
            <p className="text-sm text-sl-muted">No hay boletas que mostrar</p>
            <Link
              href="/dashboard/facturacion/boletas/nueva"
              className="mt-1 text-xs text-sl-purple transition-colors hover:text-sl-purple-light"
            >
              Emitir primera boleta
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-border/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Folio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Receptor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sl-muted">Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sl-muted">IVA</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sl-muted">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sl-muted">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {boletas.map((b) => {
                  const est = ESTADO_CONFIG[b.estado] ?? ESTADO_CONFIG.borrador
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-sl-border/40 last:border-0 transition-colors hover:bg-sl-border/10"
                    >
                      <td className="px-4 py-3 font-mono text-sl-text">
                        {b.folio ? `#${b.folio}` : <span className="text-sl-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sl-text">{fmtFecha(b.fecha)}</td>
                      <td className="px-4 py-3">
                        {b.receptor_nombre ? (
                          <>
                            <p className="max-w-[180px] truncate text-sl-text">{b.receptor_nombre}</p>
                            <p className="text-xs text-sl-muted">{b.receptor_rut}</p>
                          </>
                        ) : (
                          <span className="text-xs text-sl-muted">Consumidor final</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sl-text">
                        {fmtMonto(b.neto)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sl-muted">
                        {fmtMonto(b.iva)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-sl-text">
                        {fmtMonto(b.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            est.color
                          )}
                        >
                          {est.icon} {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {b.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => handleEmitir(b.id)}
                                disabled={emitiendo === b.id}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                              >
                                {emitiendo === b.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Zap className="h-3 w-3" />
                                )}
                                Emitir
                              </button>
                              <button
                                onClick={() => handleEliminar(b.id)}
                                className="rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-danger/50 hover:text-sl-danger"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                          {b.estado === "emitida" && b.pdf_url && (
                            <>
                              <button
                                onClick={() => setPdfModal({ url: b.pdf_url!, folio: b.folio! })}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                              >
                                <Eye className="h-3 w-3" /> Ver
                              </button>
                              <a
                                href={b.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-sl-border p-1.5 text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                title="Descargar PDF"
                              >
                                <Download className="h-3 w-3" />
                              </a>
                            </>
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

      {pdfModal && (
        <PdfModal
          url={pdfModal.url}
          titulo={`Boleta #${pdfModal.folio}`}
          onClose={() => setPdfModal(null)}
        />
      )}

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
