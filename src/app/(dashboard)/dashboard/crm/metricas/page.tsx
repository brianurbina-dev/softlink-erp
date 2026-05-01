"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Target, TrendingUp, DollarSign, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"

interface Metricas {
  byEtapa: { etapa: string; cantidad: number; valorTotal: number }[]
  ganadas: number
  perdidas: number
  totalCerradas: number
  tasaConversion: number | null
  valorPromedio: number
  vencidas: number
}

const ETAPAS_META = [
  { key: "prospecto",   label: "Prospecto",   color: "#888899", bg: "rgba(136,136,153,0.15)" },
  { key: "propuesta",   label: "Propuesta",   color: "#7F77DD", bg: "rgba(127,119,221,0.15)" },
  { key: "negociacion", label: "Negociación", color: "#BA7517", bg: "rgba(186,117,23,0.15)"  },
  { key: "ganado",      label: "Ganado",      color: "#1D9E75", bg: "rgba(29,158,117,0.15)"  },
  { key: "perdido",     label: "Perdido",     color: "#E24B4A", bg: "rgba(226,75,74,0.15)"   },
]

function fmtCLP(n: number) {
  if (n === 0) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

export default function CRMMetricasPage() {
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/crm/metricas")
      .then((r) => r.json())
      .then((j: ApiResponse<Metricas>) => {
        if (j.data) setMetricas(j.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Funnel: only "active" stages (prospecto→negociacion) in order
  const funnelEtapas = ["prospecto", "propuesta", "negociacion"]

  function getEtapaData(key: string) {
    return metricas?.byEtapa.find((b) => b.etapa === key) ?? { etapa: key, cantidad: 0, valorTotal: 0 }
  }

  const maxFunnelCantidad = Math.max(
    ...funnelEtapas.map((k) => getEtapaData(k).cantidad),
    1
  )

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/crm" className="mb-3 inline-flex items-center gap-1.5 text-sm text-sl-muted hover:text-sl-text">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al pipeline
        </Link>
        <h1 className="text-page-title text-sl-text">CRM — Métricas</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Análisis de rendimiento del pipeline comercial</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-sl-muted">Cargando...</div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sl-purple/10">
                <Target className="h-4 w-4 text-sl-purple" />
              </div>
              <p className="text-xs text-sl-muted">Tasa de conversión</p>
              <p className="mt-1.5 text-2xl font-semibold text-sl-text">
                {metricas?.tasaConversion !== null ? `${metricas?.tasaConversion}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-sl-muted">
                {metricas?.ganadas ?? 0} ganadas / {metricas?.totalCerradas ?? 0} cerradas
              </p>
            </div>

            <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sl-success/10">
                <TrendingUp className="h-4 w-4 text-sl-success" />
              </div>
              <p className="text-xs text-sl-muted">Ganadas</p>
              <p className="mt-1.5 text-2xl font-semibold text-sl-success">{metricas?.ganadas ?? 0}</p>
              <p className="mt-0.5 text-xs text-sl-muted">
                {fmtCLP(getEtapaData("ganado").valorTotal)} en total
              </p>
            </div>

            <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sl-purple/10">
                <DollarSign className="h-4 w-4 text-sl-purple" />
              </div>
              <p className="text-xs text-sl-muted">Valor promedio activo</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-sl-text">
                {fmtCLP(metricas?.valorPromedio ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-sl-muted">por oportunidad</p>
            </div>

            <div className={cn(
              "rounded-card border bg-sl-bg-card p-4",
              (metricas?.vencidas ?? 0) > 0 ? "border-sl-warning/40" : "border-sl-border"
            )}>
              <div className={cn(
                "mb-2 flex h-8 w-8 items-center justify-center rounded-lg",
                (metricas?.vencidas ?? 0) > 0 ? "bg-sl-warning/10" : "bg-sl-muted/10"
              )}>
                <AlertTriangle className={cn("h-4 w-4", (metricas?.vencidas ?? 0) > 0 ? "text-sl-warning" : "text-sl-muted")} />
              </div>
              <p className="text-xs text-sl-muted">Oportunidades vencidas</p>
              <p className={cn("mt-1.5 text-2xl font-semibold", (metricas?.vencidas ?? 0) > 0 ? "text-sl-warning" : "text-sl-text")}>
                {metricas?.vencidas ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-sl-muted">fecha cierre superada</p>
            </div>
          </div>

          {/* Funnel visual */}
          <div className="mb-6 rounded-card border border-sl-border bg-sl-bg-card p-5">
            <h2 className="mb-5 text-sm font-semibold text-sl-text">Embudo de conversión</h2>
            <div className="space-y-3">
              {funnelEtapas.map((key, idx) => {
                const meta = ETAPAS_META.find((e) => e.key === key)!
                const data = getEtapaData(key)
                const widthPct = maxFunnelCantidad > 0 ? Math.round((data.cantidad / maxFunnelCantidad) * 100) : 0
                const prevData = idx > 0 ? getEtapaData(funnelEtapas[idx - 1]) : null
                const convRate = prevData && prevData.cantidad > 0
                  ? Math.round((data.cantidad / prevData.cantidad) * 100)
                  : null

                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="text-xs text-sl-muted">{data.cantidad} oportunidades</span>
                        {convRate !== null && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: meta.bg, color: meta.color }}>
                            {convRate}% del paso anterior
                          </span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-sl-muted">{fmtCLP(data.valorTotal)}</span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-md bg-sl-border/30">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{ width: `${widthPct}%`, background: meta.color, opacity: 0.75 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumen por etapa */}
          <div className="rounded-card border border-sl-border bg-sl-bg-card">
            <div className="border-b border-sl-border px-5 py-4">
              <h2 className="text-sm font-semibold text-sl-text">Resumen por etapa</h2>
            </div>
            <div className="divide-y divide-sl-border/50">
              {ETAPAS_META.map((meta) => {
                const data = getEtapaData(meta.key)
                return (
                  <div key={meta.key} className="flex items-center gap-4 px-5 py-3">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="w-28 text-sm text-sl-text">{meta.label}</span>
                    <span className="w-16 text-sm tabular-nums text-sl-muted">{data.cantidad}</span>
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-sl-border/40">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: data.cantidad > 0
                              ? `${Math.round((data.cantidad / Math.max(...(metricas?.byEtapa.map((b) => b.cantidad) ?? [1]), 1)) * 100)}%`
                              : "0%",
                            background: meta.color,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-32 text-right text-sm tabular-nums text-sl-muted">{fmtCLP(data.valorTotal)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
