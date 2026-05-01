import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

export interface VentasMes {
  mes: string      // "YYYY-MM"
  label: string    // "Ene", "Feb", ...
  total: number
  cantidad: number
}

export interface TopCliente {
  cliente_id: string
  razon_social: string
  total: number
  cantidad: number
}

export interface TopProducto {
  descripcion: string
  total: number
  cantidad: number
}

export interface ReporteVentasData {
  ventasPorMes: VentasMes[]
  topClientes: TopCliente[]
  topProductos: TopProducto[]
  totalPeriodo: number
  cantidadDocs: number
  ticketPromedio: number
  mesActualTotal: number
  mesAnteriorTotal: number
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export async function GET(req: NextRequest) {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const s = ctx.schemaName
  const hoy = new Date()

  // Rango: últimos 6 meses por defecto
  const desdeParam = req.nextUrl.searchParams.get("desde")
  const hastaParam = req.nextUrl.searchParams.get("hasta")

  const hasta = hastaParam ? new Date(hastaParam + "T23:59:59") : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const desde = desdeParam
    ? new Date(desdeParam + "T00:00:00")
    : new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)

  const desdeStr = desde.toISOString().split("T")[0]
  const hastaStr = hasta.toISOString().split("T")[0]

  // Ventas por mes (facturas emitidas)
  const ventasFactMes = await prisma.$queryRawUnsafe<{ mes: string; total: bigint; cantidad: bigint }[]>(
    `SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
            SUM(total)::bigint        AS total,
            COUNT(*)::bigint          AS cantidad
     FROM "${s}".facturas
     WHERE estado = 'emitida' AND fecha BETWEEN $1 AND $2
     GROUP BY mes ORDER BY mes`,
    desdeStr, hastaStr
  )

  const ventasBolMes = await prisma.$queryRawUnsafe<{ mes: string; total: bigint; cantidad: bigint }[]>(
    `SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
            SUM(total)::bigint        AS total,
            COUNT(*)::bigint          AS cantidad
     FROM "${s}".boletas
     WHERE estado = 'emitida' AND fecha BETWEEN $1 AND $2
     GROUP BY mes ORDER BY mes`,
    desdeStr, hastaStr
  )

  // Merge por mes
  const mesMap = new Map<string, { total: number; cantidad: number }>()
  for (const r of [...ventasFactMes, ...ventasBolMes]) {
    const existing = mesMap.get(r.mes) ?? { total: 0, cantidad: 0 }
    mesMap.set(r.mes, {
      total: existing.total + Number(r.total),
      cantidad: existing.cantidad + Number(r.cantidad),
    })
  }

  // Generar los 6 meses del rango aunque no haya datos
  const ventasPorMes: VentasMes[] = []
  const cur = new Date(desde.getFullYear(), desde.getMonth(), 1)
  while (cur <= hasta) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    const d = mesMap.get(key) ?? { total: 0, cantidad: 0 }
    ventasPorMes.push({ mes: key, label: MESES[cur.getMonth()], ...d })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Top 10 clientes
  const topClientes = await prisma.$queryRawUnsafe<{ cliente_id: string; razon_social: string; total: bigint; cantidad: bigint }[]>(
    `SELECT f.cliente_id, c.razon_social,
            SUM(f.total)::bigint AS total,
            COUNT(*)::bigint     AS cantidad
     FROM "${s}".facturas f
     JOIN "${s}".clientes c ON c.id = f.cliente_id
     WHERE f.estado = 'emitida' AND f.fecha BETWEEN $1 AND $2
     GROUP BY f.cliente_id, c.razon_social
     ORDER BY total DESC LIMIT 10`,
    desdeStr, hastaStr
  )

  // Top 10 productos (por descripción en factura_items)
  const topProductos = await prisma.$queryRawUnsafe<{ descripcion: string; total: bigint; cantidad: bigint }[]>(
    `SELECT fi.descripcion,
            SUM(fi.subtotal)::bigint AS total,
            SUM(fi.cantidad)::bigint AS cantidad
     FROM "${s}".factura_items fi
     JOIN "${s}".facturas f ON f.id = fi.factura_id
     WHERE f.estado = 'emitida' AND f.fecha BETWEEN $1 AND $2
     GROUP BY fi.descripcion
     ORDER BY total DESC LIMIT 10`,
    desdeStr, hastaStr
  )

  const totalPeriodo = ventasPorMes.reduce((s, m) => s + m.total, 0)
  const cantidadDocs = ventasPorMes.reduce((s, m) => s + m.cantidad, 0)

  // Mes actual y anterior para comparativo
  const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const mesAnteriorKey = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`
  const mesActualTotal  = mesMap.get(mesActualKey)?.total  ?? 0
  const mesAnteriorTotal = mesMap.get(mesAnteriorKey)?.total ?? 0

  const data: ReporteVentasData = {
    ventasPorMes,
    topClientes: topClientes.map((r) => ({ ...r, total: Number(r.total), cantidad: Number(r.cantidad) })),
    topProductos: topProductos.map((r) => ({ ...r, total: Number(r.total), cantidad: Number(r.cantidad) })),
    totalPeriodo,
    cantidadDocs,
    ticketPromedio: cantidadDocs > 0 ? Math.round(totalPeriodo / cantidadDocs) : 0,
    mesActualTotal,
    mesAnteriorTotal,
  }

  return NextResponse.json<ApiResponse>({ data })
}
