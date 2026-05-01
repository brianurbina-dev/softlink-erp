"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, AlertCircle, TrendingUp, Scale, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "balance" | "resultados" | "mayor"

interface CuentaSaldo {
  id: string
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  cuenta_padre_id: string | null
  total_debe: number
  total_haber: number
  saldo: number
}

interface ResultadoRow {
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  saldo: number
}

interface MovimientoMayor {
  asiento_id: string
  fecha: string
  descripcion: string
  automatico: boolean
  debe: number
  haber: number
  saldo: number
}

interface CuentaOpt {
  id: string
  codigo: string
  nombre: string
}

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 })
}

const hoy = new Date().toISOString().slice(0, 10)
const inicioAno = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

const TIPOS_COLORES: Record<string, string> = {
  activo:     "text-blue-400",
  pasivo:     "text-red-400",
  patrimonio: "text-purple-400",
  ingreso:    "text-green-400",
  gasto:      "text-amber-400",
}

export default function ReportesContabilidadPage() {
  const [tab, setTab] = useState<Tab>("balance")
  const [desde, setDesde] = useState(inicioAno)
  const [hasta, setHasta] = useState(hoy)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Balance
  const [balanceCuentas, setBalanceCuentas] = useState<CuentaSaldo[]>([])

  // Resultados
  const [resultadoData, setResultadoData] = useState<{
    filas: ResultadoRow[]; totalIngresos: number; totalGastos: number; resultado: number
    desde: string; hasta: string
  } | null>(null)

  // Mayor
  const [cuentas, setCuentas] = useState<CuentaOpt[]>([])
  const [cuentaId, setCuentaId] = useState("")
  const [mayorData, setMayorData] = useState<{
    movimientos: MovimientoMayor[]; totalDebe: number; totalHaber: number
  } | null>(null)

  useEffect(() => {
    fetch("/api/contabilidad/plan-cuentas")
      .then((r) => r.json())
      .then((j) => setCuentas((j.data ?? []).filter((c: CuentaOpt & { acepta_movimientos: boolean }) => c.acepta_movimientos)))
  }, [])

  const cargarBalance = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/contabilidad/reportes/balance?desde=${desde}&hasta=${hasta}`).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      setBalanceCuentas(res.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [desde, hasta])

  const cargarResultados = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/contabilidad/reportes/resultados?desde=${desde}&hasta=${hasta}`).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      setResultadoData(res.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [desde, hasta])

  const cargarMayor = useCallback(async () => {
    if (!cuentaId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/contabilidad/reportes/mayor?cuentaId=${cuentaId}&desde=${desde}&hasta=${hasta}`).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      setMayorData(res.data)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [cuentaId, desde, hasta])

  useEffect(() => {
    if (tab === "balance") cargarBalance()
    if (tab === "resultados") cargarResultados()
    if (tab === "mayor" && cuentaId) cargarMayor()
  }, [tab, cargarBalance, cargarResultados, cargarMayor, cuentaId])

  // Agrupar balance por tipo
  const tiposBalance = ["activo", "pasivo", "patrimonio"]
  const totalesBalance = tiposBalance.reduce<Record<string, number>>((acc, tipo) => {
    acc[tipo] = balanceCuentas
      .filter((c) => c.tipo === tipo && !c.cuenta_padre_id)
      .reduce((s, c) => {
        const subtotal = balanceCuentas
          .filter((h) => h.tipo === tipo)
          .reduce((ss, h) => ss + (h.cuenta_padre_id ? 0 : 0), 0)
        return s + c.saldo
      }, 0)
    return acc
  }, {})

  // Totales reales agrupando por tipo (solo cuentas hoja con saldo != 0)
  const totalPorTipo = (tipo: string) =>
    balanceCuentas.filter((c) => c.tipo === tipo && !balanceCuentas.some((h) => h.cuenta_padre_id === c.id))
      .reduce((s, c) => s + c.saldo, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-sl-text">Reportes Contables</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Balance General · Estado de Resultados · Libro Mayor</p>
      </div>

      {/* Tabs + filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-lg border border-sl-border overflow-hidden">
          {([
            { key: "balance", label: "Balance General", icon: Scale },
            { key: "resultados", label: "Estado de Resultados", icon: TrendingUp },
            { key: "mayor", label: "Libro Mayor", icon: BookOpen },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                tab === key
                  ? "bg-sl-purple text-white"
                  : "text-sl-muted hover:text-sl-text hover:bg-sl-purple/[0.08]"
              )}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-sl-muted">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
          <label className="text-xs text-sl-muted">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text focus:border-sl-purple focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sl-muted">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Cargando...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-16 text-red-400">
          <AlertCircle className="h-5 w-5" /><span className="text-sm">{error}</span>
        </div>
      ) : (
        <>
          {/* ── BALANCE GENERAL ── */}
          {tab === "balance" && (
            <div className="space-y-4">
              {tiposBalance.map((tipo) => {
                const filas = balanceCuentas.filter((c) => c.tipo === tipo && c.saldo !== 0)
                if (filas.length === 0) return null
                const total = totalPorTipo(tipo)
                return (
                  <div key={tipo} className="rounded-xl border border-sl-border bg-sl-bg-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-sl-border/50 px-4 py-3">
                      <span className={cn("font-semibold uppercase text-sm tracking-wide", TIPOS_COLORES[tipo])}>
                        {tipo}
                      </span>
                      <span className="font-mono text-sm font-medium text-sl-text">{formatCLP(total)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-sl-muted border-b border-sl-border/30">
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-left">Cuenta</th>
                          <th className="px-4 py-2 text-right">Debe</th>
                          <th className="px-4 py-2 text-right">Haber</th>
                          <th className="px-4 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((c) => (
                          <tr key={c.id} className={cn(
                            "border-b border-sl-border/20 hover:bg-sl-purple/[0.04]",
                            c.cuenta_padre_id ? "pl-4" : "font-medium"
                          )}>
                            <td className="px-4 py-2 font-mono text-xs text-sl-muted"
                              style={{ paddingLeft: c.cuenta_padre_id ? "32px" : undefined }}>
                              {c.codigo}
                            </td>
                            <td className="px-4 py-2 text-sl-text">{c.nombre}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-sl-muted">
                              {c.total_debe > 0 ? formatCLP(c.total_debe) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-sl-muted">
                              {c.total_haber > 0 ? formatCLP(c.total_haber) : "—"}
                            </td>
                            <td className={cn("px-4 py-2 text-right font-mono font-medium",
                              c.saldo >= 0 ? "text-sl-text" : "text-red-400")}>
                              {formatCLP(c.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
              {/* Ecuación contable */}
              <div className="rounded-xl border border-sl-purple/30 bg-sl-purple/10 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-sl-muted">Activos</span>
                  <span className="font-mono font-medium text-sl-text">{formatCLP(totalPorTipo("activo"))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-sl-muted">Pasivos + Patrimonio</span>
                  <span className="font-mono font-medium text-sl-text">
                    {formatCLP(totalPorTipo("pasivo") + totalPorTipo("patrimonio"))}
                  </span>
                </div>
                <div className="mt-2 border-t border-sl-purple/30 pt-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-sl-purple-light">Diferencia</span>
                  <span className={cn("font-mono font-semibold",
                    Math.abs(totalPorTipo("activo") - totalPorTipo("pasivo") - totalPorTipo("patrimonio")) < 1
                      ? "text-green-400" : "text-amber-400")}>
                    {formatCLP(totalPorTipo("activo") - totalPorTipo("pasivo") - totalPorTipo("patrimonio"))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── ESTADO DE RESULTADOS ── */}
          {tab === "resultados" && resultadoData && (
            <div className="space-y-4">
              {["ingreso", "gasto"].map((tipo) => {
                const filas = resultadoData.filas.filter((f) => f.tipo === tipo && f.saldo !== 0)
                if (filas.length === 0) return null
                const total = tipo === "ingreso" ? resultadoData.totalIngresos : resultadoData.totalGastos
                return (
                  <div key={tipo} className="rounded-xl border border-sl-border bg-sl-bg-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-sl-border/50 px-4 py-3">
                      <span className={cn("font-semibold uppercase text-sm tracking-wide", TIPOS_COLORES[tipo])}>
                        {tipo === "ingreso" ? "Ingresos" : "Gastos"}
                      </span>
                      <span className="font-mono text-sm font-medium text-sl-text">{formatCLP(total)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-sl-muted border-b border-sl-border/30">
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-left">Cuenta</th>
                          <th className="px-4 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f) => (
                          <tr key={f.codigo} className="border-b border-sl-border/20 hover:bg-sl-purple/[0.04]">
                            <td className="px-4 py-2 font-mono text-xs text-sl-muted">{f.codigo}</td>
                            <td className="px-4 py-2 text-sl-text">{f.nombre}</td>
                            <td className="px-4 py-2 text-right font-mono font-medium text-sl-text">{formatCLP(f.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
              {/* Resultado neto */}
              <div className={cn(
                "rounded-xl border px-4 py-4",
                resultadoData.resultado >= 0
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              )}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sl-text">Resultado del Ejercicio</span>
                  <span className={cn("text-xl font-bold font-mono",
                    resultadoData.resultado >= 0 ? "text-green-400" : "text-red-400")}>
                    {formatCLP(resultadoData.resultado)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-sl-muted">
                  {resultadoData.resultado >= 0 ? "Utilidad" : "Pérdida"} del período {resultadoData.desde} al {resultadoData.hasta}
                </p>
              </div>
            </div>
          )}

          {/* ── LIBRO MAYOR ── */}
          {tab === "mayor" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-sl-muted shrink-0">Cuenta</label>
                <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}
                  className="flex-1 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text focus:border-sl-purple focus:outline-none">
                  <option value="">— Seleccionar cuenta —</option>
                  {cuentas.map((c: CuentaOpt) => (
                    <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                  ))}
                </select>
                <button onClick={cargarMayor} disabled={!cuentaId || loading}
                  className="rounded-lg bg-sl-purple px-3 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                  Ver
                </button>
              </div>

              {mayorData && (
                <div className="rounded-xl border border-sl-border bg-sl-bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-sl-border/50 text-[10px] uppercase tracking-wider text-sl-muted">
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Descripción</th>
                        <th className="px-4 py-3 text-right">Debe</th>
                        <th className="px-4 py-3 text-right">Haber</th>
                        <th className="px-4 py-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mayorData.movimientos.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-sl-muted">Sin movimientos en el período</td></tr>
                      ) : (
                        mayorData.movimientos.map((m, i) => (
                          <tr key={i} className="border-b border-sl-border/20 hover:bg-sl-purple/[0.04]">
                            <td className="px-4 py-2 font-mono text-xs text-sl-muted">{m.fecha?.slice(0, 10)}</td>
                            <td className="px-4 py-2 text-sl-text">{m.descripcion}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-sl-text">
                              {m.debe > 0 ? formatCLP(m.debe) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-sl-text">
                              {m.haber > 0 ? formatCLP(m.haber) : "—"}
                            </td>
                            <td className={cn("px-4 py-2 text-right font-mono font-medium",
                              m.saldo >= 0 ? "text-sl-text" : "text-red-400")}>
                              {formatCLP(m.saldo)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {mayorData.movimientos.length > 0 && (
                      <tfoot className="border-t-2 border-sl-border bg-sl-bg-dark/50 text-xs font-medium">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sl-muted">Totales del período</td>
                          <td className="px-4 py-3 text-right font-mono text-sl-text">{formatCLP(mayorData.totalDebe)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sl-text">{formatCLP(mayorData.totalHaber)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-sl-text">
                            {formatCLP(mayorData.totalDebe - mayorData.totalHaber)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
