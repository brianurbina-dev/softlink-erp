import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import type { ApiResponse } from "@/types"

type CuentaDef = {
  codigo: string
  nombre: string
  tipo: string
  subtipo: string | null
  aceptaMovimientos: boolean
  hijos?: CuentaDef[]
}

const PLAN_POR_DEFECTO: CuentaDef[] = [
  {
    codigo: "1", nombre: "ACTIVO", tipo: "activo", subtipo: null, aceptaMovimientos: false,
    hijos: [
      {
        codigo: "1.1", nombre: "Activo Circulante", tipo: "activo", subtipo: "circulante", aceptaMovimientos: false,
        hijos: [
          { codigo: "1.1.01", nombre: "Caja", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.02", nombre: "Banco", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.03", nombre: "Cuentas por Cobrar (Clientes)", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.04", nombre: "Documentos por Cobrar", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.05", nombre: "IVA Crédito Fiscal", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.06", nombre: "Existencias (Inventario)", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "1.1.07", nombre: "Gastos Pagados por Anticipado", tipo: "activo", subtipo: "circulante", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "1.2", nombre: "Activo Fijo", tipo: "activo", subtipo: "fijo", aceptaMovimientos: false,
        hijos: [
          { codigo: "1.2.01", nombre: "Maquinaria y Equipos", tipo: "activo", subtipo: "fijo", aceptaMovimientos: true },
          { codigo: "1.2.02", nombre: "Vehículos", tipo: "activo", subtipo: "fijo", aceptaMovimientos: true },
          { codigo: "1.2.03", nombre: "Mobiliario y Equipos de Oficina", tipo: "activo", subtipo: "fijo", aceptaMovimientos: true },
          { codigo: "1.2.04", nombre: "Edificios e Instalaciones", tipo: "activo", subtipo: "fijo", aceptaMovimientos: true },
          { codigo: "1.2.05", nombre: "Depreciación Acumulada", tipo: "activo", subtipo: "fijo", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "1.3", nombre: "Activo Intangible", tipo: "activo", subtipo: "intangible", aceptaMovimientos: false,
        hijos: [
          { codigo: "1.3.01", nombre: "Software y Licencias", tipo: "activo", subtipo: "intangible", aceptaMovimientos: true },
          { codigo: "1.3.02", nombre: "Marcas y Patentes", tipo: "activo", subtipo: "intangible", aceptaMovimientos: true },
        ],
      },
    ],
  },
  {
    codigo: "2", nombre: "PASIVO", tipo: "pasivo", subtipo: null, aceptaMovimientos: false,
    hijos: [
      {
        codigo: "2.1", nombre: "Pasivo Circulante", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: false,
        hijos: [
          { codigo: "2.1.01", nombre: "Cuentas por Pagar (Proveedores)", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "2.1.02", nombre: "Documentos por Pagar", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "2.1.03", nombre: "IVA Débito Fiscal", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "2.1.04", nombre: "Impuesto a la Renta por Pagar", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "2.1.05", nombre: "Remuneraciones por Pagar", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
          { codigo: "2.1.06", nombre: "Préstamos Bancarios Corto Plazo", tipo: "pasivo", subtipo: "circulante", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "2.2", nombre: "Pasivo No Circulante", tipo: "pasivo", subtipo: "no_circulante", aceptaMovimientos: false,
        hijos: [
          { codigo: "2.2.01", nombre: "Préstamos Bancarios Largo Plazo", tipo: "pasivo", subtipo: "no_circulante", aceptaMovimientos: true },
          { codigo: "2.2.02", nombre: "Hipotecas por Pagar", tipo: "pasivo", subtipo: "no_circulante", aceptaMovimientos: true },
        ],
      },
    ],
  },
  {
    codigo: "3", nombre: "PATRIMONIO", tipo: "patrimonio", subtipo: null, aceptaMovimientos: false,
    hijos: [
      {
        codigo: "3.1", nombre: "Capital", tipo: "patrimonio", subtipo: "capital", aceptaMovimientos: false,
        hijos: [
          { codigo: "3.1.01", nombre: "Capital Social", tipo: "patrimonio", subtipo: "capital", aceptaMovimientos: true },
          { codigo: "3.1.02", nombre: "Reserva Legal", tipo: "patrimonio", subtipo: "capital", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "3.2", nombre: "Resultados", tipo: "patrimonio", subtipo: "resultados", aceptaMovimientos: false,
        hijos: [
          { codigo: "3.2.01", nombre: "Resultado del Ejercicio", tipo: "patrimonio", subtipo: "resultados", aceptaMovimientos: true },
          { codigo: "3.2.02", nombre: "Utilidades Retenidas", tipo: "patrimonio", subtipo: "resultados", aceptaMovimientos: true },
        ],
      },
    ],
  },
  {
    codigo: "4", nombre: "INGRESOS", tipo: "ingreso", subtipo: null, aceptaMovimientos: false,
    hijos: [
      {
        codigo: "4.1", nombre: "Ingresos Operacionales", tipo: "ingreso", subtipo: "operacional", aceptaMovimientos: false,
        hijos: [
          { codigo: "4.1.01", nombre: "Ventas Afectas (con IVA)", tipo: "ingreso", subtipo: "operacional", aceptaMovimientos: true },
          { codigo: "4.1.02", nombre: "Ventas Exentas (sin IVA)", tipo: "ingreso", subtipo: "operacional", aceptaMovimientos: true },
          { codigo: "4.1.03", nombre: "Servicios Prestados Afectos", tipo: "ingreso", subtipo: "operacional", aceptaMovimientos: true },
          { codigo: "4.1.04", nombre: "Servicios Prestados Exentos", tipo: "ingreso", subtipo: "operacional", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "4.2", nombre: "Ingresos No Operacionales", tipo: "ingreso", subtipo: "no_operacional", aceptaMovimientos: false,
        hijos: [
          { codigo: "4.2.01", nombre: "Intereses Ganados", tipo: "ingreso", subtipo: "no_operacional", aceptaMovimientos: true },
          { codigo: "4.2.02", nombre: "Arriendos Percibidos", tipo: "ingreso", subtipo: "no_operacional", aceptaMovimientos: true },
          { codigo: "4.2.03", nombre: "Otros Ingresos", tipo: "ingreso", subtipo: "no_operacional", aceptaMovimientos: true },
        ],
      },
    ],
  },
  {
    codigo: "5", nombre: "GASTOS", tipo: "gasto", subtipo: null, aceptaMovimientos: false,
    hijos: [
      {
        codigo: "5.1", nombre: "Costo de Ventas", tipo: "gasto", subtipo: "costo_ventas", aceptaMovimientos: false,
        hijos: [
          { codigo: "5.1.01", nombre: "Costo de Mercadería Vendida", tipo: "gasto", subtipo: "costo_ventas", aceptaMovimientos: true },
          { codigo: "5.1.02", nombre: "Costo de Servicios Prestados", tipo: "gasto", subtipo: "costo_ventas", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "5.2", nombre: "Gastos de Administración", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: false,
        hijos: [
          { codigo: "5.2.01", nombre: "Remuneraciones Personal Administrativo", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.02", nombre: "Honorarios Profesionales", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.03", nombre: "Arriendos", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.04", nombre: "Servicios Básicos (agua, luz, gas)", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.05", nombre: "Telefonía e Internet", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.06", nombre: "Gastos de Oficina y Librería", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.07", nombre: "Depreciación del Ejercicio", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
          { codigo: "5.2.08", nombre: "Seguros", tipo: "gasto", subtipo: "administracion", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "5.3", nombre: "Gastos de Ventas", tipo: "gasto", subtipo: "ventas", aceptaMovimientos: false,
        hijos: [
          { codigo: "5.3.01", nombre: "Comisiones de Ventas", tipo: "gasto", subtipo: "ventas", aceptaMovimientos: true },
          { codigo: "5.3.02", nombre: "Publicidad y Marketing", tipo: "gasto", subtipo: "ventas", aceptaMovimientos: true },
          { codigo: "5.3.03", nombre: "Fletes y Distribución", tipo: "gasto", subtipo: "ventas", aceptaMovimientos: true },
          { codigo: "5.3.04", nombre: "Representación y Viáticos", tipo: "gasto", subtipo: "ventas", aceptaMovimientos: true },
        ],
      },
      {
        codigo: "5.4", nombre: "Gastos Financieros", tipo: "gasto", subtipo: "financiero", aceptaMovimientos: false,
        hijos: [
          { codigo: "5.4.01", nombre: "Intereses Bancarios", tipo: "gasto", subtipo: "financiero", aceptaMovimientos: true },
          { codigo: "5.4.02", nombre: "Comisiones Bancarias", tipo: "gasto", subtipo: "financiero", aceptaMovimientos: true },
          { codigo: "5.4.03", nombre: "Diferencias de Cambio", tipo: "gasto", subtipo: "financiero", aceptaMovimientos: true },
        ],
      },
    ],
  },
]

// Upsert: inserta si no existe, actualiza a valores estándar si ya existe.
// Siempre retorna el id para poder procesar hijos correctamente.
async function upsertCuentas(
  schema: string,
  cuentas: CuentaDef[],
  padreId: string | null,
  conteo: { insertadas: number; actualizadas: number }
): Promise<void> {
  for (const c of cuentas) {
    const [row] = await prisma.$queryRawUnsafe<{ id: string; es_nueva: boolean }[]>(
      `INSERT INTO "${schema}".plan_cuentas
         (codigo, nombre, tipo, subtipo, cuenta_padre_id, acepta_movimientos, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (codigo) DO UPDATE SET
         nombre             = EXCLUDED.nombre,
         tipo               = EXCLUDED.tipo,
         subtipo            = EXCLUDED.subtipo,
         cuenta_padre_id    = EXCLUDED.cuenta_padre_id,
         acepta_movimientos = EXCLUDED.acepta_movimientos,
         activo             = true
       RETURNING id, (xmax::text::bigint = 0) AS es_nueva`,
      c.codigo, c.nombre, c.tipo, c.subtipo, padreId, c.aceptaMovimientos
    )

    if (row.es_nueva) conteo.insertadas++
    else conteo.actualizadas++

    if (c.hijos?.length) {
      await upsertCuentas(schema, c.hijos, row.id, conteo)
    }
  }
}

export async function POST() {
  const ctx = await getEmpresaContext()
  if (!ctx) return NextResponse.json<ApiResponse>({ error: "No autenticado" }, { status: 401 })

  const conteo = { insertadas: 0, actualizadas: 0 }
  await upsertCuentas(ctx.schemaName, PLAN_POR_DEFECTO, null, conteo)

  return NextResponse.json<ApiResponse>({ data: conteo }, { status: 201 })
}
