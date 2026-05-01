"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Loader2, AlertCircle, Zap, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Cuenta {
  id: string
  codigo: string
  nombre: string
  acepta_movimientos: boolean
}

interface Regla {
  id: string
  evento: string
  cuenta_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  tipo: "debe" | "haber"
  campo_monto: "neto" | "iva" | "total"
  orden: number
  activo: boolean
}

const EVENTOS: Record<string, { label: string; desc: string }> = {
  factura_emitida:       { label: "Factura emitida",        desc: "Se dispara al emitir facturas tipo 33 y 34" },
  boleta_emitida:        { label: "Boleta emitida",         desc: "Se dispara al emitir boletas tipo 39" },
  compra_recibida:       { label: "Compra recibida",        desc: "Se dispara al recepcionar una orden de compra" },
  nota_credito_emitida:  { label: "Nota de crédito",        desc: "Se dispara al emitir notas de crédito tipo 61" },
}

const CAMPOS: Record<string, string> = { neto: "Neto (sin IVA)", iva: "IVA", total: "Total" }

export default function ReglasPage() {
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [initLoading, setInitLoading] = useState(false)
  const [addEvento, setAddEvento] = useState<string | null>(null)
  const [form, setForm] = useState({ cuentaId: "", tipo: "debe" as "debe" | "haber", campo_monto: "total" as "neto" | "iva" | "total", orden: 0 })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [rReglas, rCuentas] = await Promise.all([
      fetch("/api/contabilidad/reglas").then((r) => r.json()),
      fetch("/api/contabilidad/plan-cuentas").then((r) => r.json()),
    ])
    setReglas(rReglas.data ?? [])
    setCuentas((rCuentas.data ?? []).filter((c: Cuenta) => c.acepta_movimientos))
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleInicializar() {
    const eventosEstandar = ["factura_emitida", "boleta_emitida", "compra_recibida", "nota_credito_emitida"]
    const reglasExistentes = reglas.filter((r) => eventosEstandar.includes(r.evento))

    const mensaje = reglasExistentes.length > 0
      ? `Ya existen ${reglasExistentes.length} regla(s) en los eventos estándar.\n\nSe eliminarán y reemplazarán por las reglas predefinidas de Chile. Las reglas de eventos personalizados no se tocarán.\n\nRequiere que el Plan de Cuentas esté cargado.\n\n¿Continuar?`
      : "¿Cargar las reglas contables estándar para Chile?\n\nSe crearán 12 reglas para los 4 eventos principales.\n\nRequiere que el Plan de Cuentas esté cargado."
    if (!confirm(mensaje)) return

    setInitLoading(true)
    const res = await fetch("/api/contabilidad/reglas/inicializar", { method: "POST" }).then((r) => r.json())
    setInitLoading(false)
    if (res.error) { alert(res.error); return }
    const { eliminadas, insertadas } = res.data
    if (eliminadas > 0) {
      alert(`Operación completada:\n• ${eliminadas} regla(s) anteriores eliminadas\n• ${insertadas} regla(s) estándar insertadas`)
    }
    await cargar()
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return
    await fetch(`/api/contabilidad/reglas/${id}`, { method: "DELETE" })
    await cargar()
  }

  async function handleToggle(id: string, activo: boolean) {
    await fetch(`/api/contabilidad/reglas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    })
    await cargar()
  }

  async function handleAgregar() {
    if (!addEvento) return
    setFormError(null)
    setSaving(true)
    const res = await fetch("/api/contabilidad/reglas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento: addEvento, ...form }),
    }).then((r) => r.json())
    setSaving(false)
    if (res.error) { setFormError(res.error); return }
    setAddEvento(null)
    setForm({ cuentaId: "", tipo: "debe", campo_monto: "total", orden: 0 })
    await cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-sl-text">Reglas Contables</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Configura los asientos automáticos por evento del sistema</p>
        </div>
        <button
          onClick={handleInicializar}
          disabled={initLoading}
          className="flex items-center gap-2 rounded-lg border border-sl-purple/40 bg-sl-purple/10 px-3 py-2 text-sm text-sl-purple-light hover:bg-sl-purple/20 disabled:opacity-50"
        >
          {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Cargar reglas estándar Chile
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sl-muted">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Cargando...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(EVENTOS).map(([evento, info]) => {
            const reglasEvento = reglas.filter((r) => r.evento === evento)
            return (
              <div key={evento} className="rounded-xl border border-sl-border bg-sl-bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-sl-border/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-sl-text">{info.label}</p>
                    <p className="text-xs text-sl-muted">{info.desc}</p>
                  </div>
                  <button
                    onClick={() => { setAddEvento(evento); setFormError(null) }}
                    className="flex items-center gap-1.5 rounded-lg bg-sl-purple/10 px-2.5 py-1.5 text-xs text-sl-purple-light hover:bg-sl-purple/20"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar regla
                  </button>
                </div>

                {reglasEvento.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-4 text-xs text-sl-muted">
                    <Settings2 className="h-4 w-4 opacity-40" />
                    Sin reglas — los eventos no generarán asientos automáticos
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-sl-muted border-b border-sl-border/30">
                        <th className="px-4 py-2 text-left">Cuenta</th>
                        <th className="px-4 py-2 text-center">Tipo</th>
                        <th className="px-4 py-2 text-center">Monto</th>
                        <th className="px-4 py-2 text-center">Estado</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {reglasEvento.map((r) => (
                        <tr key={r.id} className={cn("border-b border-sl-border/20 hover:bg-sl-purple/[0.04]", !r.activo && "opacity-50")}>
                          <td className="px-4 py-2">
                            <span className="font-mono text-xs text-sl-muted mr-2">{r.cuenta_codigo}</span>
                            <span className="text-sl-text">{r.cuenta_nombre}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium",
                              r.tipo === "debe"
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-green-500/15 text-green-400"
                            )}>
                              {r.tipo.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-sl-muted">{CAMPOS[r.campo_monto]}</td>
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => handleToggle(r.id, !r.activo)}
                              className={cn("rounded px-2 py-0.5 text-[11px] font-medium",
                                r.activo ? "bg-green-500/15 text-green-400" : "bg-sl-border/40 text-sl-muted"
                              )}>
                              {r.activo ? "Activa" : "Inactiva"}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => handleEliminar(r.id)}
                              className="rounded p-1 text-sl-muted hover:bg-red-500/20 hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal agregar regla */}
      {addEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-sl-border bg-sl-bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-sl-text">
                Nueva regla — {EVENTOS[addEvento]?.label}
              </h2>
              <button onClick={() => setAddEvento(null)} className="text-sl-muted hover:text-sl-text">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-sl-muted">Cuenta *</label>
                <select value={form.cuentaId} onChange={(e) => setForm((f) => ({ ...f, cuentaId: e.target.value }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none">
                  <option value="">— Seleccionar cuenta —</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-sl-muted">Tipo *</label>
                  <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as "debe" | "haber" }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none">
                    <option value="debe">DEBE</option>
                    <option value="haber">HABER</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-sl-muted">Monto a usar *</label>
                  <select value={form.campo_monto} onChange={(e) => setForm((f) => ({ ...f, campo_monto: e.target.value as "neto" | "iva" | "total" }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none">
                    {Object.entries(CAMPOS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-sl-muted">Orden</label>
                <input type="number" min="0" value={form.orden}
                  onChange={(e) => setForm((f) => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
              </div>
              {formError && (
                <p className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />{formError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAddEvento(null)}
                  className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">
                  Cancelar
                </button>
                <button onClick={handleAgregar} disabled={saving || !form.cuentaId}
                  className="flex items-center gap-2 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Agregar regla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
