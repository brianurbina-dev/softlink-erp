import type { Result } from "@/types"

export interface DatosFactura {
  tipo: 33 | 34
  clienteRut: string
  clienteRazonSocial: string
  clienteGiro: string
  clienteDireccion: string
  items: ItemFactura[]
  fechaEmision: Date
}

export interface DatosBoleta {
  items: ItemFactura[]
  fechaEmision: Date
}

export interface ItemFactura {
  nombre: string
  cantidad: number
  precioUnitario: number
  afectoIva: boolean
}

export interface ResultadoDTE {
  folio: number
  trackId: string
  pdfUrl?: string
  xmlUrl?: string
}

export type EstadoDTE = "pendiente" | "aceptado" | "rechazado" | "anulado"

export interface DTEService {
  emitirFactura(datos: DatosFactura): Promise<Result<ResultadoDTE>>
  emitirBoleta(datos: DatosBoleta): Promise<Result<ResultadoDTE>>
  anularDocumento(folio: number, tipo: number): Promise<Result<boolean>>
  consultarEstado(trackId: string): Promise<Result<EstadoDTE>>
  obtenerPDF(folio: number, tipo: number): Promise<Result<Buffer>>
}
