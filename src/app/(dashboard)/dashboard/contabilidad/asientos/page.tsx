"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Trash2, Loader2, AlertCircle, BookMarked,
  ChevronDown, ChevronRight, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Cuenta {
  id: string
  codigo: string
  nombre: string
  tipo: string
  acepta_movimientos: boolean
}

interface Asiento {
  id: string
  fecha: string
  descripcion: string
  referencia_tipo: string | null
  automatico: boolean
  total_debe: number
  total_haber: number
}

interface Linea {
  id: string
  cuenta_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  debe: number
  haber: number
}

interface FormLinea {
  cuentaId: string
  debe: string
  haber: string
}

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 })
}

const hoy = new Date().toISOString().slice(0, 10)
const inicioAno = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

export default function AsientosPage() {
  const [asientos, setAsientos] = useState<Asiento[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(inicioAno)
  const [hasta, setHasta] = useState(hoy)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lineasDetalle, setLineasDetalle] = useState<Record<string, Linea[]>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [formFecha, setFormFecha] = useState(hoy)
  const [formDesc, setFormDesc] = useState("")
  const [formLineas, setFormLineas] = useState<FormLinea[]>([
    { cuentaId: "", debe: "", haber: "" },
    { cuentaId: "", debe: "", haber: "" },
  ])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [rasientos, rcuentas] = await Promise.all([
      fetch(`/api/contabilidad/asientos?desde=${desde}&hasta=${hasta}`).then((r) => r.json()),
      fetch("/api/contabilidad/plan-cuentas").then((r) => r.json()),
    ])
    setAsientos(rasientos.data ?? [])
    setCuentas((rcuentas.data ?? []).filter((c: Cuenta) => c.acepta_movimientos))
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  async function toggleDetalle(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!lineasDetalle[id]) {
      const res = await fetch(`/api/contabilidad/asientos/${id}`).then((r) => r.json())
      setLineasDetalle((prev) => ({ ...prev, [id]: res.data ?? [] }))
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este asiento?")) return
    const res = await fetch(`/api/contabilidad/asientos/${id}`, { method: "DELETE" }).then((r) => r.json())
    if (res.error) { alert(res.error); return }
    await cargar()
  }

  function addLinea() {
    setFormLineas((prev) => [...prev, { cuentaId: "", debe: "", haber: "" }])
  }

  function removeLinea(i: number) {
    setFormLineas((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateLinea(i: number, field: keyof FormLinea, value: string) {
    setFormLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const totalDebe = formLineas.reduce((s, l) => s + (parseInt(l.debe) || 0), 0)
  const totalHaber = formLineas.reduce((s, l) => s + (parseInt(l.haber) || 0), 0)
  const cuadra = totalDebe === totalHaber && totalDebe > 0

  async function handleGuardar() {
    setFormError(null)
    if (!cuadra) { setFormError("El asiento no cuadra (debe ≠ haber)"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/contabilidad/asientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: formFecha,
          descripcion: formDesc,
          lineas: formLineas
            .filter((l) => l.cuentaId)
            .map((l) => ({
              cuentaId: l.cuentaId,
              debe: parseInt(l.debe) || 0,
              haber: parseInt(l.haber) || 0,
            })),
        }),
      }).then((r) => r.json())
      if (res.error) { setFormError(res.error); return }
      setModalOpen(false)
      setFormFecha(hoy)
      setFormDesc("")
      setFormLineas([{ cuentaId: "", debe: "", haber: "" }, { cuentaId: "", debe: "", haber: "" }])
      await cargar()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-sl-text">Asientos Contables</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Partida doble — manual y automática</p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setFormError(null) }}
          className="flex items-center gap-2 rounded-lg bg-sl-purple px-3 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" /> Nuevo asiento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-sl-muted">Desde</label>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
        <label className="text-xs text-sl-muted">Hasta</label>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-sl-border bg-sl-bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sl-muted">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Cargando...</span>
          </div>
        ) : asientos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <BookMarked className="h-8 w-8 text-sl-muted/40" />
            <p className="text-sm text-sl-muted">No hay asientos en el período seleccionado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-border/50 text-[11px] uppercase tracking-wider text-sl-muted">
                <th className="px-4 py-3 text-left w-8" />
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Debe</th>
                <th className="px-4 py-3 text-right">Haber</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {asientos.map((a) => (
                <>
                  <tr
                    key={a.id}
                    className="group border-b border-sl-border/30 hover:bg-sl-purple/[0.04] cursor-pointer"
                    onClick={() => toggleDetalle(a.id)}
                  >
                    <td className="px-4 py-3 text-sl-muted">
                      {expanded === a.id
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="px-4 py-3 text-sl-muted font-mono text-xs">{a.fecha?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-sl-text">{a.descripcion}</td>
                    <td className="px-4 py-3 text-right font-mono text-sl-text">{formatCLP(a.total_debe)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sl-text">{formatCLP(a.total_haber)}</td>
                    <td className="px-4 py-3 text-center">
                      {a.automatico
                        ? <span className="flex items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-sl-purple/15 text-sl-purple-light"><Zap className="h-2.5 w-2.5" /> Auto</span>
                        : <span className="rounded px-1.5 py-0.5 text-[10px] bg-sl-border/40 text-sl-muted">Manual</span>}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {!a.automatico && (
                        <button onClick={() => handleEliminar(a.id)}
                          className="rounded p-1 text-sl-muted hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr key={`${a.id}-detail`} className="bg-sl-bg-dark/50">
                      <td colSpan={7} className="px-8 py-3">
                        {!lineasDetalle[a.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin text-sl-muted" />
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-sl-muted">
                                <th className="py-1 text-left">Cuenta</th>
                                <th className="py-1 text-right">Debe</th>
                                <th className="py-1 text-right">Haber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineasDetalle[a.id].map((l) => (
                                <tr key={l.id} className="border-t border-sl-border/20">
                                  <td className="py-1 text-sl-text">
                                    <span className="font-mono text-sl-muted mr-2">{l.cuenta_codigo}</span>
                                    {l.cuenta_nombre}
                                  </td>
                                  <td className="py-1 text-right font-mono text-sl-text">
                                    {l.debe > 0 ? formatCLP(l.debe) : "—"}
                                  </td>
                                  <td className="py-1 text-right font-mono text-sl-text">
                                    {l.haber > 0 ? formatCLP(l.haber) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo asiento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-xl border border-sl-border bg-sl-bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-sl-text">Nuevo asiento contable</h2>
              <button onClick={() => setModalOpen(false)} className="text-sl-muted hover:text-sl-text">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="mb-1 block text-xs text-sl-muted">Fecha *</label>
                <input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-sl-muted">Descripción *</label>
                <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="ej: Pago de arriendo mayo"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder-sl-muted/50 focus:border-sl-purple focus:outline-none" />
              </div>
            </div>

            {/* Tabla de líneas */}
            <div className="rounded-lg border border-sl-border overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sl-bg-dark text-[11px] uppercase tracking-wider text-sl-muted">
                    <th className="px-3 py-2 text-left">Cuenta</th>
                    <th className="px-3 py-2 text-right w-32">Debe (CLP)</th>
                    <th className="px-3 py-2 text-right w-32">Haber (CLP)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {formLineas.map((linea, i) => (
                    <tr key={i} className="border-t border-sl-border/30">
                      <td className="px-3 py-2">
                        <select value={linea.cuentaId} onChange={(e) => updateLinea(i, "cuentaId", e.target.value)}
                          className="w-full rounded border border-sl-border bg-sl-bg-dark px-2 py-1.5 text-xs text-sl-text focus:border-sl-purple focus:outline-none">
                          <option value="">— Seleccionar cuenta —</option>
                          {cuentas.map((c) => (
                            <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={linea.debe}
                          onChange={(e) => { updateLinea(i, "debe", e.target.value); if (e.target.value) updateLinea(i, "haber", "") }}
                          placeholder="0"
                          className="w-full rounded border border-sl-border bg-sl-bg-dark px-2 py-1.5 text-xs text-right text-sl-text focus:border-sl-purple focus:outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={linea.haber}
                          onChange={(e) => { updateLinea(i, "haber", e.target.value); if (e.target.value) updateLinea(i, "debe", "") }}
                          placeholder="0"
                          className="w-full rounded border border-sl-border bg-sl-bg-dark px-2 py-1.5 text-xs text-right text-sl-text focus:border-sl-purple focus:outline-none" />
                      </td>
                      <td className="px-2">
                        {formLineas.length > 2 && (
                          <button onClick={() => removeLinea(i)} className="text-sl-muted hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Totales */}
                  <tr className="border-t-2 border-sl-border bg-sl-bg-dark/50 text-xs font-medium">
                    <td className="px-3 py-2 text-sl-muted">Totales</td>
                    <td className={cn("px-3 py-2 text-right font-mono", cuadra ? "text-green-400" : "text-amber-400")}>
                      {totalDebe.toLocaleString("es-CL")}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-mono", cuadra ? "text-green-400" : "text-amber-400")}>
                      {totalHaber.toLocaleString("es-CL")}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <button onClick={addLinea}
              className="mb-4 flex items-center gap-1 text-xs text-sl-purple-light hover:text-sl-purple">
              <Plus className="h-3.5 w-3.5" /> Agregar línea
            </button>

            {formError && (
              <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />{formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)}
                className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving || !cuadra}
                className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar asiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
