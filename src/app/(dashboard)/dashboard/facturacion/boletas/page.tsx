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
  FileCode2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"
import { PdfModal } from "@/components/erp/PdfModal"
import { XmlViewerModal } from "@/components/erp/XmlViewerModal"

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
  email_estado: string | null
  email_destinatario: string | null
}

interface BoletaDetalle extends BoletaRow {
  items: {
    id: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
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
  const router = useRouter()
  const [boletas, setBoletas] = useState<BoletaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<BoletaDetalle | null>(null)
  const [pdfModal, setPdfModal] = useState<{ url: string; folio: number } | null>(null)
  const [xmlModal, setXmlModal] = useState<{ id: string; folio: number } | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

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

  async function handlePrevisualizar(id: string) {
    setPreviewing(id)
    try {
      const res = await fetch(`/api/boletas/${id}/preview`)
      if (!res.ok) return notify("Error al generar vista previa", false)
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } finally {
      setPreviewing(null)
    }
  }

  async function handleVerDetalle(id: string) {
    const res = await fetch(`/api/boletas/${id}`)
    const json = await res.json()
    if (!res.ok) return notify(json.error ?? "Error al cargar detalle", false)
    setDetalle(json.data as BoletaDetalle)
  }

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
                      onClick={
                        b.estado === "emitida"
                          ? () => handleVerDetalle(b.id)
                          : b.estado === "borrador"
                          ? () => router.push(`/dashboard/facturacion/boletas/${b.id}/editar`)
                          : undefined
                      }
                      className={cn(
                        "border-b border-sl-border/40 last:border-0 transition-colors hover:bg-sl-border/10",
                        (b.estado === "emitida" || b.estado === "borrador") && "cursor-pointer"
                      )}
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {b.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => handlePrevisualizar(b.id)}
                                disabled={previewing === b.id}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                              >
                                {previewing === b.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                                Previsualizar
                              </button>
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
                          {b.estado === "emitida" && (
                            <>
                              {b.pdf_url && (
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
                              {b.folio && (
                                <button
                                  onClick={() => setXmlModal({ id: b.id, folio: b.folio! })}
                                  className="rounded-md border border-sl-border p-1.5 text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                  title="Ver XML"
                                >
                                  <FileCode2 className="h-3 w-3" />
                                </button>
                              )}
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

      {/* Modal vista previa PDF */}
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

      {/* Modal visor XML */}
      {xmlModal && (
        <XmlViewerModal
          xmlUrl={`/api/boletas/${xmlModal.id}/xml`}
          downloadUrl={`/api/boletas/${xmlModal.id}/xml?download=1`}
          titulo={`XML — Boleta N° ${xmlModal.folio}`}
          onClose={() => setXmlModal(null)}
        />
      )}

      {/* Modal PDF emitida */}
      {pdfModal && (
        <PdfModal
          url={pdfModal.url}
          titulo={`Boleta N° ${pdfModal.folio}`}
          onClose={() => setPdfModal(null)}
        />
      )}

      {/* Modal detalle boleta emitida */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setDetalle(null)}
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-sl-border bg-sl-bg-card shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-sl-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-sl-text">
                  Boleta{detalle.folio ? ` — Folio #${detalle.folio}` : ""}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  (ESTADO_CONFIG[detalle.estado] ?? ESTADO_CONFIG.borrador).color
                )}>
                  {(ESTADO_CONFIG[detalle.estado] ?? ESTADO_CONFIG.borrador).icon}
                  {(ESTADO_CONFIG[detalle.estado] ?? ESTADO_CONFIG.borrador).label}
                </span>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg p-1.5 text-sl-muted transition-colors hover:bg-sl-border/40 hover:text-sl-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {/* Datos generales */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-sl-muted">Fecha emisión</p>
                  <p className="mt-0.5 text-sl-text">{fmtFecha(detalle.fecha)}</p>
                </div>
                <div>
                  <p className="text-xs text-sl-muted">Track ID</p>
                  <p className="mt-0.5 font-mono text-xs text-sl-text">{detalle.track_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-sl-muted">Receptor</p>
                  {detalle.receptor_nombre ? (
                    <>
                      <p className="mt-0.5 text-sl-text">{detalle.receptor_nombre}</p>
                      <p className="text-xs text-sl-muted">{detalle.receptor_rut}</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sl-muted">Consumidor final</p>
                  )}
                </div>
              </div>

              {/* Ítems */}
              <div>
                <p className="mb-2 text-xs font-medium text-sl-muted">Ítems</p>
                <div className="rounded-lg border border-sl-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-sl-border/60 bg-sl-bg-dark/40">
                        <th className="px-3 py-2 text-left font-medium text-sl-muted">Descripción</th>
                        <th className="px-3 py-2 text-center font-medium text-sl-muted">Cant.</th>
                        <th className="px-3 py-2 text-right font-medium text-sl-muted">Precio unit.</th>
                        <th className="px-3 py-2 text-right font-medium text-sl-muted">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((item, i) => (
                        <tr key={item.id ?? i} className="border-b border-sl-border/30 last:border-0">
                          <td className="px-3 py-2 text-sl-text">{item.descripcion}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-sl-text">{item.cantidad}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-sl-text">
                            {fmtMonto(item.precio_unitario)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-sl-text">
                            {fmtMonto(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="flex justify-end">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-12">
                    <span className="text-sl-muted">Neto</span>
                    <span className="font-mono tabular-nums text-sl-text">{fmtMonto(detalle.neto)}</span>
                  </div>
                  {detalle.iva > 0 && (
                    <div className="flex justify-between gap-12">
                      <span className="text-sl-muted">IVA (19%)</span>
                      <span className="font-mono tabular-nums text-sl-muted">{fmtMonto(detalle.iva)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-12 border-t border-sl-border/60 pt-1 font-semibold">
                    <span className="text-sl-text">Total</span>
                    <span className="font-mono tabular-nums text-sl-text">{fmtMonto(detalle.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer acciones */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-sl-border px-5 py-3">
              {detalle.pdf_url && (
                <>
                  <button
                    onClick={() => { setDetalle(null); setPdfModal({ url: detalle.pdf_url!, folio: detalle.folio! }) }}
                    className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver PDF
                  </button>
                  <a
                    href={detalle.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar PDF
                  </a>
                </>
              )}
              {detalle.folio && (
                <button
                  onClick={() => { setDetalle(null); setXmlModal({ id: detalle.id, folio: detalle.folio! }) }}
                  className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                >
                  <FileCode2 className="h-3.5 w-3.5" /> Ver XML
                </button>
              )}
            </div>
          </div>
        </div>
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
