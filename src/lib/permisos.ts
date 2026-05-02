export const SECCIONES_ERP = [
  { key: "maestros",     label: "Maestros",     descripcion: "Clientes, proveedores y productos" },
  { key: "facturacion",  label: "Facturación",  descripcion: "Facturas, boletas, guías y notas" },
  { key: "inventario",   label: "Inventario",   descripcion: "Stock, bodegas y movimientos" },
  { key: "compras",      label: "Compras",      descripcion: "Órdenes de compra y recepciones" },
  { key: "crm",          label: "CRM",          descripcion: "Pipeline y métricas comerciales" },
  { key: "contabilidad", label: "Contabilidad", descripcion: "Plan de cuentas, asientos y reportes" },
  { key: "reportes",     label: "Reportes",     descripcion: "Reportes de ventas, inventario y compras" },
] as const

export type SeccionKey = typeof SECCIONES_ERP[number]["key"]

export function puedeVer(
  permiso: string | undefined,
  empresaRol: string,
  permisos: string[]
): boolean {
  if (!permiso) return true
  if (empresaRol === "admin") return true
  if (permiso === "admin") return false
  return permisos.includes(permiso)
}
