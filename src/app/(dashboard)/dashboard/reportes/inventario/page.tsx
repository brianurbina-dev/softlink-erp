"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReporteInventarioData } from "@/app/api/reportes/inventario/route"

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

const TIPO_CONFIG = {
  entrada: { label: "Entradas",  color: "bg-sl-success" },
  salida:  { label: "Salidas",   color: "bg-sl-danger"  },
  ajuste:  { label: "Ajustes",   color: "bg-sl-warning" },
} as const

export default function ReporteInventarioPage() {
  const [data, setData] = useState<ReporteInventarioData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/reportes/inventario")
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data) })
      .finally(() => setLoading(false))
  }, [])

  const d = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title text-sl-text">Reporte de inventario</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Valorización y movimientos del stock actual</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-sl-muted">Calculando...</div>
      ) : !d ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Valor total en stock</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sl-text">{fmtCLP(d.valorTotalStock)}</p>
            </div>
            <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
              <p className="text-xs text-sl-muted">Productos en inventario</p>
              <p className="mt-1 text-2xl font-semibold text-sl-text">{d.totalProductos}</p>
            </div>
            <div className={cn("rounded-card border bg-sl-bg-card px-4 py-3", d.productosStockBajo > 0 ? "border-sl-warning/40" : "border-sl-border")}>
              <p className="text-xs text-sl-muted">Bajo mínimo</p>
              <p className={cn("mt-1 text-2xl font-semibold", d.productosStockBajo > 0 ? "text-sl-warning" : "text-sl-text")}>
                {d.productosStockBajo}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Valor por bodega */}
            <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-sl-text">Valor por bodega</h2>
              {d.valorPorBodega.length === 0 ? (
                <p className="py-4 text-center text-sm text-sl-muted">Sin bodegas con stock</p>
              ) : (
                <div className="space-y-3">
                  {d.valorPorBodega.map((b) => {
                    const pct = d.valorTotalStock > 0 ? (b.valor / d.valorTotalStock) * 100 : 0
                    return (
                      <div key={b.bodega_nombre}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-sl-text">{b.bodega_nombre}</span>
                          <span className="tabular-nums text-sl-muted">{fmtCLP(b.valor)} · {b.productos} prod.</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-sl-border/50">
                          <div className="h-2 rounded-full bg-sl-purple" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Movimientos del mes */}
            <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
              <h2 className="mb-1 text-sm font-semibold text-sl-text">Movimientos del mes actual</h2>
              <p className="mb-4 text-xs text-sl-muted">Entradas, salidas y ajustes registrados este mes</p>
              {d.movimientosMes.length === 0 ? (
                <p className="py-4 text-center text-sm text-sl-muted">Sin movimientos este mes</p>
              ) : (
                <div className="space-y-3">
                  {d.movimientosMes.map((m) => {
                    const cfg = TIPO_CONFIG[m.tipo as keyof typeof TIPO_CONFIG]
                    return (
                      <div key={m.tipo} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", cfg?.color ?? "bg-sl-muted")} />
                          <span className="text-sm text-sl-text">{cfg?.label ?? m.tipo}</span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="font-semibold tabular-nums text-sl-text">{m.cantidad.toLocaleString("es-CL")}</span>
                          <span className="ml-1 text-xs text-sl-muted">unid. · {m.movimientos} mov.</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top productos por valor */}
          <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-sl-text">Top productos por valor en stock</h2>
            {d.topValor.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-sl-muted/40" />
                <p className="text-sm text-sl-muted">Sin productos con costo promedio registrado</p>
                <p className="mt-1 text-xs text-sl-muted/60">Registra entradas con costo para ver la valorización</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sl-border">
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">#</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Producto</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Stock</th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topValor.map((p, i) => (
                      <tr key={i} className="border-b border-sl-border/40 last:border-0">
                        <td className="py-2 pr-4 text-xs text-sl-muted">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <p className="font-medium text-sl-text">{p.nombre}</p>
                          <p className="text-xs text-sl-muted">{p.codigo}</p>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-sl-muted">{p.stock_actual.toLocaleString("es-CL")}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-sl-text">{fmtCLP(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
