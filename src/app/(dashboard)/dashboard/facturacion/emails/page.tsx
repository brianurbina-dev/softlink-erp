"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Mail, MailCheck, MailX, MailWarning, RefreshCw,
  Search, Filter, Send, Clock, CheckCircle, XCircle,
} from "lucide-react"

interface EmailLog {
  id: string
  documento_tipo: string
  documento_id: string
  tipo_dte: number
  folio: number | null
  destinatario: string
  asunto: string
  estado: string
  resend_id: string | null
  error_mensaje: string | null
  creado_en: string
}

interface Stats {
  total: number
  enviados: number
  fallidos: number
  sin_destinatario: number
  hoy: number
}

const TIPO_LABELS: Record<number, string> = {
  33: "Factura Afecta",
  34: "Factura Exenta",
  39: "Boleta",
  52: "Guía de Despacho",
  56: "Nota de Débito",
  61: "Nota de Crédito",
}

const DOC_LABELS: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  guia: "Guía",
  nota: "Nota",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} d`
}

function EmailStatusBadge({ estado }: { estado: string }) {
  if (estado === "enviado") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}>
        <MailCheck className="w-3.5 h-3.5" />
        Enviado
      </span>
    )
  }
  if (estado === "fallido") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: "rgba(226,75,74,0.12)", color: "#E24B4A" }}>
        <MailX className="w-3.5 h-3.5" />
        Fallido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "rgba(127,119,221,0.1)", color: "#AFA9EC" }}>
      <MailWarning className="w-3.5 h-3.5" />
      Sin email
    </span>
  )
}

export default function EmailsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, enviados: 0, fallidos: 0, sin_destinatario: 0, hoy: 0 })
  const [loading, setLoading] = useState(true)
  const [reenviadoId, setReenviadoId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState("")
  const [filterTipo, setFilterTipo] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (filterEstado) q.set("estado", filterEstado)
    if (filterTipo) q.set("tipo", filterTipo)
    if (search) q.set("search", search)
    const res = await fetch(`/api/email/logs?${q}`)
    if (res.ok) {
      const json = await res.json()
      setLogs(json.data.logs)
      setStats(json.data.stats)
    }
    setLoading(false)
  }, [search, filterEstado, filterTipo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleReenviar(log: EmailLog) {
    setReenviadoId(log.id)
    try {
      const res = await fetch("/api/email/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentoTipo: log.documento_tipo,
          documentoId: log.documento_id,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        notify(j.error ?? "Error al reenviar", false)
      } else {
        notify("Correo reenviado exitosamente", true)
        fetchLogs()
      }
    } catch {
      notify("Error de conexión", false)
    } finally {
      setReenviadoId(null)
    }
  }

  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl text-sm font-medium transition-all"
          style={{ background: toast.ok ? "rgba(29,158,117,0.95)" : "rgba(226,75,74,0.95)", color: "#fff" }}>
          {toast.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--sl-text, #f0f0f5)" }}>
            Seguimiento de Correos DTE
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--sl-muted, #888899)" }}>
            {today} · Historial de envíos automáticos al emitir documentos
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ background: "var(--sl-bg-card, #16161f)", border: "1px solid var(--sl-border, #2a2a3a)", color: "var(--sl-muted, #888899)" }}
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total enviados",
            value: stats.enviados,
            icon: MailCheck,
            color: "#1D9E75",
            bg: "rgba(29,158,117,0.1)",
          },
          {
            label: "Enviados hoy",
            value: stats.hoy,
            icon: Clock,
            color: "#7F77DD",
            bg: "rgba(127,119,221,0.1)",
          },
          {
            label: "Fallidos",
            value: stats.fallidos,
            icon: MailX,
            color: "#E24B4A",
            bg: "rgba(226,75,74,0.1)",
          },
          {
            label: "Sin destinatario",
            value: stats.sin_destinatario,
            icon: MailWarning,
            color: "#BA7517",
            bg: "rgba(186,117,23,0.1)",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{
              background: "var(--sl-bg-card, #16161f)",
              border: "1px solid var(--sl-border, #2a2a3a)",
            }}
          >
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: kpi.bg }}>
              <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--sl-text, #f0f0f5)" }}>
                {kpi.value}
              </div>
              <div className="text-xs" style={{ color: "var(--sl-muted, #888899)" }}>
                {kpi.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-center"
        style={{
          background: "var(--sl-bg-card, #16161f)",
          border: "1px solid var(--sl-border, #2a2a3a)",
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--sl-muted, #888899)" }} />
          <input
            type="text"
            placeholder="Buscar por email o folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--sl-text, #f0f0f5)" }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: "var(--sl-muted, #888899)" }} />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 outline-none appearance-none cursor-pointer"
            style={{
              background: "var(--sl-bg-dark, #0f0f14)",
              border: "1px solid var(--sl-border, #2a2a3a)",
              color: "var(--sl-text, #f0f0f5)",
            }}
          >
            <option value="">Todos los estados</option>
            <option value="enviado">Enviados</option>
            <option value="fallido">Fallidos</option>
            <option value="sin_destinatario">Sin email</option>
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 outline-none appearance-none cursor-pointer"
            style={{
              background: "var(--sl-bg-dark, #0f0f14)",
              border: "1px solid var(--sl-border, #2a2a3a)",
              color: "var(--sl-text, #f0f0f5)",
            }}
          >
            <option value="">Todos los tipos</option>
            <option value="factura">Facturas</option>
            <option value="boleta">Boletas</option>
            <option value="guia">Guías</option>
            <option value="nota">Notas C/D</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--sl-bg-card, #16161f)",
          border: "1px solid var(--sl-border, #2a2a3a)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sl-border, #2a2a3a)" }}>
              {["Tipo doc.", "Folio", "Destinatario", "Asunto", "Enviado", "Estado", "Acción"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--sl-muted, #888899)" }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: "var(--sl-muted, #888899)" }}>
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(127,119,221,0.1)" }}
                    >
                      <Mail className="w-6 h-6" style={{ color: "#7F77DD" }} />
                    </div>
                    <p style={{ color: "var(--sl-muted, #888899)" }}>
                      No hay registros de correos
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--sl-border, #2a2a3a)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(127,119,221,0.04)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* Tipo */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-md w-fit"
                        style={{
                          background: "rgba(127,119,221,0.12)",
                          color: "#AFA9EC",
                        }}
                      >
                        {DOC_LABELS[log.documento_tipo] ?? log.documento_tipo}
                      </span>
                      <span className="text-xs" style={{ color: "var(--sl-muted, #888899)" }}>
                        Tipo {log.tipo_dte} · {TIPO_LABELS[log.tipo_dte] ?? "DTE"}
                      </span>
                    </div>
                  </td>

                  {/* Folio */}
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--sl-text, #f0f0f5)" }}>
                    {log.folio ?? "—"}
                  </td>

                  {/* Destinatario */}
                  <td className="px-4 py-3 max-w-[180px]">
                    {log.destinatario === "sin_destinatario" ? (
                      <span style={{ color: "var(--sl-muted, #888899)", fontStyle: "italic" }}>
                        Sin email registrado
                      </span>
                    ) : (
                      <span
                        className="text-sm truncate block"
                        style={{ color: "var(--sl-text, #f0f0f5)" }}
                        title={log.destinatario}
                      >
                        {log.destinatario}
                      </span>
                    )}
                  </td>

                  {/* Asunto */}
                  <td
                    className="px-4 py-3 text-xs max-w-[200px] truncate"
                    style={{ color: "var(--sl-muted, #888899)" }}
                    title={log.asunto}
                  >
                    {log.asunto || "—"}
                  </td>

                  {/* Fecha */}
                  <td
                    className="px-4 py-3 text-xs whitespace-nowrap"
                    style={{ color: "var(--sl-muted, #888899)" }}
                    title={new Date(log.creado_en).toLocaleString("es-CL")}
                  >
                    {timeAgo(log.creado_en)}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <EmailStatusBadge estado={log.estado} />
                      {log.error_mensaje && (
                        <span
                          className="text-xs truncate max-w-[140px]"
                          style={{ color: "#E24B4A" }}
                          title={log.error_mensaje}
                        >
                          {log.error_mensaje}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Acción */}
                  <td className="px-4 py-3">
                    {(log.estado === "fallido" || log.estado === "enviado") &&
                    log.destinatario !== "sin_destinatario" ? (
                      <button
                        onClick={() => handleReenviar(log)}
                        disabled={reenviadoId === log.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                        style={{
                          background: "rgba(127,119,221,0.12)",
                          color: "#AFA9EC",
                          border: "1px solid rgba(127,119,221,0.2)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(127,119,221,0.2)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(127,119,221,0.12)"
                        }}
                      >
                        {reenviadoId === log.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Reenviar
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--sl-muted, #888899)" }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        {logs.length > 0 && (
          <div
            className="px-4 py-3 flex items-center justify-between text-xs"
            style={{
              borderTop: "1px solid var(--sl-border, #2a2a3a)",
              color: "var(--sl-muted, #888899)",
            }}
          >
            <span>{logs.length} registro{logs.length !== 1 ? "s" : ""}</span>
            <span>
              {stats.enviados} enviados · {stats.fallidos} fallidos · {stats.sin_destinatario} sin email
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
