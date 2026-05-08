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
  Eye,
  FileCode2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"
import { PdfModal } from "@/components/erp/PdfModal"
import { XmlViewerModal } from "@/components/erp/XmlViewerModal"

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
  email_estado: string | null
  email_destinatario: string | null
}

interface GuiaDetalle extends GuiaRow {
  track_id: string | null
  items: {
    id: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
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
  const router = useRouter()
  const [guias, setGuias] = useState<GuiaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [facturando, setFacturando] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<GuiaDetalle | null>(null)
  const [pdfModal, setPdfModal] = useState<{ url: string; folio: number } | null>(null)
  const [xmlModal, setXmlModal] = useState<{ id: string; folio: number } | null>(null)
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

  async function handlePrevisualizar(id: string) {
    setPreviewing(id)
    try {
      const res = await fetch(`/api/guias/${id}/preview`)
      if (!res.ok) return notify("Error al generar vista previa", false)
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } finally {
      setPreviewing(null)
    }
  }

  async function handleVerDetalle(id: string) {
    const res = await fetch(`/api/guias/${id}`)
    const json = await res.json()
    if (!res.ok) return notify(json.error ?? "Error al cargar detalle", false)
    setDetalle(json.data as GuiaDetalle)
  }

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
                    <tr
                      key={g.id}
                      onClick={
                        g.estado === "emitida" || g.estado === "facturada"
                          ? () => handleVerDetalle(g.id)
                          : g.estado === "borrador"
                          ? () => router.push(`/dashboard/facturacion/guias/${g.id}/editar`)
                          : undefined
                      }
                      className={cn(
                        "border-b border-sl-border/40 last:border-0 transition-colors hover:bg-sl-border/10",
                        (g.estado === "emitida" || g.estado === "facturada" || g.estado === "borrador") && "cursor-pointer"
                      )}
                    >
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
                            <p className="text-xs text-sl-muted">Ref. Fact. #{g.ref_folio}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {g.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => handlePrevisualizar(g.id)}
                                disabled={previewing === g.id}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light disabled:opacity-50"
                              >
                                {previewing === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                                Previsualizar
                              </button>
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
                                <>
                                  <button
                                    onClick={() => setPdfModal({ url: g.pdf_url!, folio: g.folio! })}
                                    className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                  >
                                    <Eye className="h-3 w-3" /> Ver
                                  </button>
                                  <a
                                    href={g.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md border border-sl-border p-1.5 text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                    title="Descargar PDF"
                                  >
                                    <Download className="h-3 w-3" />
                                  </a>
                                </>
                              )}
                              {g.folio && (
                                <button
                                  onClick={() => setXmlModal({ id: g.id, folio: g.folio! })}
                                  className="rounded-md border border-sl-border p-1.5 text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                  title="Ver XML"
                                >
                                  <FileCode2 className="h-3 w-3" />
                                </button>
                              )}
                            </>
                          )}
                          {g.estado === "facturada" && g.pdf_url && (
                            <>
                              <button
                                onClick={() => setPdfModal({ url: g.pdf_url!, folio: g.folio! })}
                                className="flex items-center gap-1 rounded-md border border-sl-border px-2.5 py-1 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                              >
                                <Eye className="h-3 w-3" /> Ver
                              </button>
                              <a
                                href={g.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-sl-border p-1.5 text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
                                title="Descargar PDF"
                              >
                                <Download className="h-3 w-3" />
                              </a>
                              {g.folio && (
                                <button
                                  onClick={() => setXmlModal({ id: g.id, folio: g.folio! })}
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
          titulo="Vista previa de guía de despacho"
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
          xmlUrl={`/api/guias/${xmlModal.id}/xml`}
          downloadUrl={`/api/guias/${xmlModal.id}/xml?download=1`}
          titulo={`XML — Guía N° ${xmlModal.folio}`}
          onClose={() => setXmlModal(null)}
        />
      )}

      {/* Modal PDF emitida */}
      {pdfModal && (
        <PdfModal
          url={pdfModal.url}
          titulo={`Guía de Despacho #${pdfModal.folio}`}
          onClose={() => setPdfModal(null)}
        />
      )}

      {/* Modal detalle guía */}
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
            <div className="flex shrink-0 items-center justify-between border-b border-sl-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-sl-text">
                  Guía de Despacho{detalle.folio ? ` — Folio #${detalle.folio}` : ""}
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
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-sl-muted">Fecha</p>
                  <p className="mt-0.5 text-sl-text">{fmtFecha(detalle.fecha)}</p>
                </div>
                <div>
                  <p className="text-xs text-sl-muted">Tipo traslado</p>
                  <p className="mt-0.5 text-sl-text">{TIPO_TRASLADO[detalle.tipo_traslado]?.label ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-sl-muted">Receptor</p>
                  {detalle.cliente_razon_social ? (
                    <>
                      <p className="mt-0.5 text-sl-text">{detalle.cliente_razon_social}</p>
                      <p className="text-xs text-sl-muted">{detalle.cliente_rut}</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sl-muted">Traslado interno</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-sl-muted">Track ID</p>
                  <p className="mt-0.5 font-mono text-xs text-sl-text">{detalle.track_id ?? "—"}</p>
                </div>
              </div>

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
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-sl-text">{fmtMonto(item.precio_unitario)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-sl-text">{fmtMonto(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
