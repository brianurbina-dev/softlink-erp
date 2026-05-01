"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { BarChart } from "@/components/erp/BarChart"
import { cn } from "@/lib/utils"
import type { ReporteComprasData } from "@/app/api/reportes/compras/route"

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

export default function ReporteComprasPage() {
  const [data, setData] = useState<ReporteComprasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  })
  const [hasta, setHasta] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/compras?desde=${desde}&hasta=${hasta}`)
      const json = await res.json()
      if (res.ok) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => { load() }, [load])

  const d = data
  const margenPositivo = (d?.margenBruto ?? 0) >= 0

  const chartData = (d?.comprasPorMes ?? []).map((m) => ({
    label: m.label,
    value: m.total,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Reporte de compras</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Órdenes de compra recibidas y margen bruto estimado</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text outline-none focus:border-sl-purple" />
          <span className="text-sl-muted">—</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-1.5 text-sm text-sl-text outline-none focus:border-sl-purple" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-sl-muted">Calculando...</div>
      ) : !d ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Total compras período</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.totalPeriodo)}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Órdenes recibidas</p>
              <p className="mt-1 text-2xl font-semibold text-sl-text">{d.cantidadOrdenes}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Ventas mismo período</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.totalVentasPeriodo)}</p>
            </div>
            <div className={cn("rounded-card border bg-sl-bg-card px-4 py-3", margenPositivo ? "border-sl-success/40" : "border-sl-danger/40")}>
              <p className="text-xs text-sl-muted">Margen bruto estimado</p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", margenPositivo ? "text-sl-success" : "text-sl-danger")}>
                {fmtCLP(d.margenBruto)}
              </p>
              <div className={cn("mt-0.5 flex items-center gap-1 text-xs", margenPositivo ? "text-sl-success" : "text-sl-danger")}>
                {margenPositivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {d.totalVentasPeriodo > 0
                  ? `${Math.round((d.margenBruto / d.totalVentasPeriodo) * 100)}% s/ ventas`
                  : "Sin ventas en período"}
              </div>
            </div>
          </div>

          {/* Gráfico compras por mes */}
          <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-sl-text">Compras por mes (recibidas)</h2>
            {d.comprasPorMes.every((m) => m.total === 0) ? (
              <p className="py-8 text-center text-sm text-sl-muted">Sin compras recibidas en el período</p>
            ) : (
              <BarChart
                data={chartData}
                height={160}
                formatValue={fmtCLP}
                color="rgba(186,117,23,0.35)"
                highlightColor="#BA7517"
              />
            )}
          </div>

          {/* Top proveedores */}
          <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-sl-text">Top proveedores</h2>
            {d.topProveedores.length === 0 ? (
              <p className="py-4 text-center text-sm text-sl-muted">Sin compras recibidas en el período</p>
            ) : (
              <div className="space-y-2">
                {d.topProveedores.map((p, i) => {
                  const pctBar = d.topProveedores[0].total > 0 ? (p.total / d.topProveedores[0].total) * 100 : 0
                  return (
                    <div key={p.proveedor_id}>
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs text-sl-text">
                          <span className="w-4 text-right text-sl-muted">{i + 1}</span>
                          <span className="truncate max-w-[200px]">{p.razon_social}</span>
                          <span className="text-sl-muted">· {p.cantidad} OC</span>
                        </span>
                        <span className="text-xs tabular-nums font-medium text-sl-text">{fmtCLP(p.total)}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-sl-border/50">
                        <div className="h-1 rounded-full bg-sl-warning" style={{ width: `${pctBar}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
