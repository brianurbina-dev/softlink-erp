import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { cookies } from "next/headers"
import Link from "next/link"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { puedeVer } from "@/lib/permisos"

interface KpiData {
  ventasMes: number
  ventasMesAnterior: number
  docsEmitidosMes: number
  stockBajoCant: number
  pipelineActivo: number
}

async function getKpis(schemaName: string): Promise<KpiData> {
  const s = schemaName
  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`
  const inicioMesAnterior = (() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  })()
  const finMesAnterior = (() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getDate()}`
  })()

  const [ventasMesRow] = await prisma.$queryRawUnsafe<{ total: bigint; cantidad: bigint }[]>(
    `SELECT COALESCE(SUM(total),0)::bigint AS total, COUNT(*)::bigint AS cantidad
     FROM "${s}".facturas WHERE estado = 'emitida' AND fecha >= $1`,
    inicioMes
  )
  const [boletasMesRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COALESCE(SUM(total),0)::bigint AS total
     FROM "${s}".boletas WHERE estado = 'emitida' AND fecha >= $1`,
    inicioMes
  )
  const [ventasAnteriorRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COALESCE(SUM(total),0)::bigint AS total
     FROM "${s}".facturas WHERE estado = 'emitida' AND fecha BETWEEN $1 AND $2`,
    inicioMesAnterior, finMesAnterior
  )
  const [boletasAnteriorRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COALESCE(SUM(total),0)::bigint AS total
     FROM "${s}".boletas WHERE estado = 'emitida' AND fecha BETWEEN $1 AND $2`,
    inicioMesAnterior, finMesAnterior
  )
  const [stockBajoRow] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n
     FROM "${s}".inventario i
     JOIN "${s}".productos p ON p.id = i.producto_id
     WHERE i.stock_actual <= p.stock_minimo`
  )
  const [pipelineRow] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM "${s}".oportunidades
     WHERE etapa NOT IN ('ganado','perdido')`
  )

  return {
    ventasMes: Number(ventasMesRow?.total ?? 0) + Number(boletasMesRow?.total ?? 0),
    ventasMesAnterior: Number(ventasAnteriorRow?.total ?? 0) + Number(boletasAnteriorRow?.total ?? 0),
    docsEmitidosMes: Number(ventasMesRow?.cantidad ?? 0),
    stockBajoCant: Number(stockBajoRow?.n ?? 0),
    pipelineActivo: Number(pipelineRow?.n ?? 0),
  }
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function DeltaBadge({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior === 0) return null
  const pct = Math.round(((actual - anterior) / anterior) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-xs text-sl-muted"><Minus className="h-3 w-3" />0%</span>
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${pct > 0 ? "text-sl-success" : "text-sl-danger"}`}>
      {pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pct > 0 ? "+" : ""}{pct}% vs mes ant.
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const empresaIdCookie = cookieStore.get("sl_empresa_id")?.value

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: user!.id },
    include: { empresas: { include: { empresa: true } } },
  })

  const euActiva =
    usuario?.empresas.find((eu) => eu.empresa.id === empresaIdCookie) ??
    usuario?.empresas[0]

  const empresa = euActiva?.empresa
  const empresaRol = euActiva?.rol ?? "usuario"
  const permisos: string[] = euActiva?.permisos ?? []

  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  const schemaName = empresa?.schemaName
  const kpis = schemaName ? await getKpis(schemaName) : null

  const accesosRapidos = [
    { href: "/dashboard/facturacion/facturas/nueva", label: "Nueva factura",    permiso: "facturacion" },
    { href: "/dashboard/facturacion/boletas/nueva",  label: "Nueva boleta",     permiso: "facturacion" },
    { href: "/dashboard/compras/nueva",              label: "Nueva compra",     permiso: "compras"     },
    { href: "/dashboard/crm",                        label: "Pipeline CRM",     permiso: "crm"         },
    { href: "/dashboard/inventario/movimientos",     label: "Ingreso de stock", permiso: "inventario"  },
  ].filter(a => puedeVer(a.permiso, empresaRol, permisos))

  const reportesLinks = [
    { href: "/dashboard/reportes/ventas",     label: "Reporte de ventas",     desc: "Análisis por mes, clientes y productos" },
    { href: "/dashboard/reportes/inventario", label: "Reporte de inventario", desc: "Valorización y movimientos de stock"    },
    { href: "/dashboard/reportes/compras",    label: "Reporte de compras",    desc: "Proveedores y margen bruto estimado"    },
  ].filter(() => puedeVer("reportes", empresaRol, permisos))

  const puedeVerInventario = puedeVer("inventario", empresaRol, permisos)
  const puedeVerCRM        = puedeVer("crm",        empresaRol, permisos)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-sl-text">Dashboard</h1>
        <p className="mt-0.5 text-sm text-sl-muted capitalize">
          {empresa?.razonSocial} · {today}
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Ventas del mes</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-sl-text">
            {kpis ? fmtCLP(kpis.ventasMes) : "—"}
          </p>
          {kpis && <DeltaBadge actual={kpis.ventasMes} anterior={kpis.ventasMesAnterior} />}
        </div>

        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Facturas emitidas (mes)</p>
          <p className="mt-2 text-2xl font-semibold text-sl-text">
            {kpis ? kpis.docsEmitidosMes : "—"}
          </p>
        </div>

        <div className={`rounded-card border bg-sl-bg-card p-4 ${kpis && kpis.stockBajoCant > 0 ? "border-sl-warning/40" : "border-sl-border"}`}>
          <p className="text-xs text-sl-muted">Stock bajo mínimo</p>
          <p className={`mt-2 text-2xl font-semibold ${kpis && kpis.stockBajoCant > 0 ? "text-sl-warning" : "text-sl-text"}`}>
            {kpis ? kpis.stockBajoCant : "—"}
          </p>
          {kpis && kpis.stockBajoCant > 0 && puedeVerInventario && (
            <Link href="/dashboard/inventario?bajo=1" className="text-xs text-sl-warning underline-offset-2 hover:underline">
              Ver productos
            </Link>
          )}
        </div>

        <div className="rounded-card border border-sl-border bg-sl-bg-card p-4">
          <p className="text-xs text-sl-muted">Pipeline CRM activo</p>
          <p className="mt-2 text-2xl font-semibold text-sl-text">
            {kpis ? kpis.pipelineActivo : "—"}
          </p>
          {puedeVerCRM && (
            <Link href="/dashboard/crm" className="text-xs text-sl-purple hover:underline underline-offset-2">
              Ver pipeline
            </Link>
          )}
        </div>
      </div>

      {/* Links rápidos a reportes */}
      {reportesLinks.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {reportesLinks.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="rounded-card border border-sl-border bg-sl-bg-card p-4 transition-colors hover:border-sl-purple/40 hover:bg-sl-purple/[0.04]"
            >
              <p className="font-medium text-sl-text">{r.label}</p>
              <p className="mt-0.5 text-xs text-sl-muted">{r.desc}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Accesos rápidos */}
      {accesosRapidos.length > 0 && (
        <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-sl-text">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-2">
            {accesosRapidos.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-lg border border-sl-border px-3 py-1.5 text-sm text-sl-muted transition-colors hover:border-sl-purple/40 hover:text-sl-text"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
