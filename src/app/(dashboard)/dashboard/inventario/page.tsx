"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, AlertTriangle, Package, ArrowUpRight, Settings2, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface StockRow {
  id: string
  producto_id: string
  producto_codigo: string
  producto_nombre: string
  producto_unidad: string
  producto_stock_minimo: number
  bodega_id: string
  bodega_nombre: string
  stock_actual: number
  costo_promedio: number
  actualizado_en: string
}

interface Bodega {
  id: string
  nombre: string
  activa: boolean
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function InventarioPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [bodegaFiltro, setBodegaFiltro] = useState("")
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async (opts?: { q?: string; bodega?: string; bajo?: boolean }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.q) params.set("search", opts.q)
      if (opts?.bodega) params.set("bodega", opts.bodega)
      if (opts?.bajo) params.set("bajo", "1")
      const res = await fetch(`/api/inventario?${params}`)
      const json = await res.json()
      if (res.ok) setRows(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch("/api/bodegas").then((r) => r.json()).then((j) => setBodegas(j.data ?? []))
  }, [load])

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load({ q: v, bodega: bodegaFiltro, bajo: soloStockBajo }), 350)
  }

  function onBodegaChange(v: string) {
    setBodegaFiltro(v)
    load({ q: search, bodega: v, bajo: soloStockBajo })
  }

  function onBajoChange(v: boolean) {
    setSoloStockBajo(v)
    load({ q: search, bodega: bodegaFiltro, bajo: v })
  }

  const stockBajoCount = rows.filter((r) => r.stock_actual <= r.producto_stock_minimo).length
  const totalProductos = new Set(rows.map((r) => r.producto_id)).size
  const valorTotal = rows.reduce((sum, r) => sum + r.stock_actual * r.costo_promedio, 0)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Stock actual</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Nivel de inventario por producto y bodega</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/inventario/movimientos"
            className="flex items-center gap-1.5 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text"
          >
            <ArrowUpRight className="h-4 w-4" />
            Movimientos
          </Link>
          <Link
            href="/dashboard/inventario/bodegas"
            className="flex items-center gap-1.5 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-muted transition-colors hover:text-sl-text"
          >
            <Settings2 className="h-4 w-4" />
            Bodegas
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Productos en stock</p>
          <p className="mt-1 text-2xl font-semibold text-sl-text">{totalProductos}</p>
        </div>
        <div
          className={cn("rounded-card border bg-sl-bg-card px-4 py-3 cursor-pointer transition-colors", soloStockBajo ? "border-sl-warning/50 bg-sl-warning/5" : "border-sl-border")}
          onClick={() => onBajoChange(!soloStockBajo)}
          title="Click para filtrar stock bajo"
        >
          <p className="text-xs text-sl-muted">Stock bajo mínimo</p>
          <p className={cn("mt-1 text-2xl font-semibold", stockBajoCount > 0 ? "text-sl-warning" : "text-sl-text")}>{stockBajoCount}</p>
        </div>
        <div className="rounded-card border border-sl-border bg-sl-bg-card px-4 py-3">
          <p className="text-xs text-sl-muted">Valor en inventario</p>
          <p className="mt-1 text-2xl font-semibold text-sl-text">{fmtCLP(valorTotal)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sl-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-9 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
          />
        </div>
        <select
          value={bodegaFiltro}
          onChange={(e) => onBodegaChange(e.target.value)}
          className="rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
        >
          <option value="">Todas las bodegas</option>
          {bodegas.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        {soloStockBajo && (
          <button
            onClick={() => onBajoChange(false)}
            className="flex items-center gap-1.5 rounded-lg border border-sl-warning/50 bg-sl-warning/10 px-3 py-2 text-sm text-sl-warning"
          >
            <AlertTriangle className="h-4 w-4" />
            Solo stock bajo
            <span className="ml-1 text-sl-muted">×</span>
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Producto</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted sm:table-cell">Bodega</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Stock</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Mínimo</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted lg:table-cell">Costo prom.</th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted xl:table-cell">Valor total</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted xl:table-cell">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Package className="mx-auto mb-3 h-10 w-10 text-sl-muted/40" />
                  <p className="text-sm text-sl-muted">Sin stock registrado</p>
                  <p className="mt-1 text-xs text-sl-muted/60">
                    Registra movimientos de entrada para comenzar
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const bajo = r.stock_actual <= r.producto_stock_minimo
                return (
                  <tr key={r.id} className={cn("border-b border-sl-border/50 last:border-0 hover:bg-sl-purple/[0.04]", bajo && "bg-sl-warning/[0.03]")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {bajo ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-sl-warning" />
                        ) : (
                          <CheckCircle className="h-4 w-4 shrink-0 text-sl-success/50" />
                        )}
                        <div>
                          <p className="font-medium text-sl-text">{r.producto_nombre}</p>
                          <p className="text-xs text-sl-muted">{r.producto_codigo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-sl-muted sm:table-cell">{r.bodega_nombre}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-semibold tabular-nums", bajo ? "text-sl-warning" : "text-sl-text")}>
                        {r.stock_actual.toLocaleString("es-CL")}
                      </span>
                      <span className="ml-1 text-xs text-sl-muted">{r.producto_unidad}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted md:table-cell">
                      {r.producto_stock_minimo.toLocaleString("es-CL")}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted lg:table-cell">
                      {r.costo_promedio > 0 ? fmtCLP(r.costo_promedio) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-sl-muted xl:table-cell">
                      {r.costo_promedio > 0 ? fmtCLP(r.stock_actual * r.costo_promedio) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-sl-muted xl:table-cell">{fmtDate(r.actualizado_en)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {!loading && rows.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {rows.length} registro{rows.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  )
}
