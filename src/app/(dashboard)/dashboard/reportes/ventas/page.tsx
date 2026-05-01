"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingUp, TrendingDown, Minus, FileText } from "lucide-react"
import { BarChart } from "@/components/erp/BarChart"
import { cn } from "@/lib/utils"
import type { ReporteVentasData } from "@/app/api/reportes/ventas/route"

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function delta(actual: number, anterior: number) {
  if (anterior === 0) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

export default function ReporteVentasPage() {
  const [data, setData] = useState<ReporteVentasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  })
  const [hasta, setHasta] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/ventas?desde=${desde}&hasta=${hasta}`)
      const json = await res.json()
      if (res.ok) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => { load() }, [load])

  const hoy = new Date()
  const mesActualLabel = hoy.toLocaleString("es-CL", { month: "long", year: "numeric" })
  const d = data
  const pct = d ? delta(d.mesActualTotal, d.mesAnteriorTotal) : null

  const chartData = (d?.ventasPorMes ?? []).map((m, i, arr) => ({
    label: m.label,
    value: m.total,
    highlight: i === arr.length - 1,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Reporte de ventas</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Facturas y boletas emitidas</p>
        </div>
        {/* Filtro rango */}
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text outline-none focus:border-sl-purple"
          />
          <span className="text-sl-muted">—</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text outline-none focus:border-sl-purple"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-sl-muted">Calculando...</div>
      ) : !d ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Total período</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.totalPeriodo)}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Documentos emitidos</p>
              <p className="mt-1 text-2xl font-semibold text-sl-text">{d.cantidadDocs}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Ticket promedio</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.ticketPromedio)}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted capitalize">{mesActualLabel}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.mesActualTotal)}</p>
              {pct !== null && (
                <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", pct > 0 ? "text-sl-success" : pct < 0 ? "text-sl-danger" : "text-sl-muted")}>
                  {pct > 0 ? <TrendingUp className="h-3 w-3" /> : pct < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {pct > 0 ? "+" : ""}{pct}% vs mes anterior
                </div>
              )}
            </div>
          </div>

          {/* Gráfico ventas por mes */}
          <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-sl-text">Ventas por mes</h2>
            {d.ventasPorMes.every((m) => m.total === 0) ? (
              <p className="py-8 text-center text-sm text-sl-muted">Sin ventas en el período</p>
            ) : (
              <BarChart
                data={chartData}
                height={180}
                formatValue={fmtCLP}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top clientes */}
            <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-sl-text">Top clientes</h2>
              {d.topClientes.length === 0 ? (
                <p className="py-4 text-center text-sm text-sl-muted">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {d.topClientes.map((c, i) => {
                    const pctBar = d.topClientes[0].total > 0 ? (c.total / d.topClientes[0].total) * 100 : 0
                    return (
                      <div key={c.cliente_id}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs text-sl-text">
                            <span className="w-4 text-right text-sl-muted">{i + 1}</span>
                            <span className="truncate max-w-[180px]">{c.razon_social}</span>
                          </span>
                          <span className="text-xs tabular-nums font-medium text-sl-text">{fmtCLP(c.total)}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-sl-border/50">
                          <div className="h-1 rounded-full bg-sl-purple" style={{ width: `${pctBar}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top productos */}
            <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-sl-text">Top productos / servicios</h2>
              {d.topProductos.length === 0 ? (
                <p className="py-4 text-center text-sm text-sl-muted">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {d.topProductos.map((p, i) => {
                    const pctBar = d.topProductos[0].total > 0 ? (p.total / d.topProductos[0].total) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs text-sl-text">
                            <span className="w-4 text-right text-sl-muted">{i + 1}</span>
                            <span className="truncate max-w-[180px]">{p.descripcion}</span>
                          </span>
                          <span className="text-xs tabular-nums font-medium text-sl-text">{fmtCLP(p.total)}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-sl-border/50">
                          <div className="h-1 rounded-full bg-sl-purple/60" style={{ width: `${pctBar}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
