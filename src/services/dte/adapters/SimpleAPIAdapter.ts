import type { DTEService, DatosFactura, DatosBoleta, ResultadoDTE, EstadoDTE } from "../DTEService"
import type { Result } from "@/types"

export class SimpleAPIAdapter implements DTEService {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.baseUrl = process.env.SIMPLEAPI_BASE_URL ?? "https://api.simpleapi.cl"
    this.apiKey = apiKey
  }

  async emitirFactura(datos: DatosFactura): Promise<Result<ResultadoDTE>> {
    // TODO: Módulo 2.1 — implementar emisión vía SimpleAPI
    return { ok: false, error: new Error("Not implemented") }
  }

  async emitirBoleta(datos: DatosBoleta): Promise<Result<ResultadoDTE>> {
    // TODO: Módulo 2.3 — implementar emisión de boletas vía SimpleAPI
    return { ok: false, error: new Error("Not implemented") }
  }

  async anularDocumento(folio: number, tipo: number): Promise<Result<boolean>> {
    // TODO: Módulo 2.4 — implementar anulación vía SimpleAPI
    return { ok: false, error: new Error("Not implemented") }
  }

  async consultarEstado(trackId: string): Promise<Result<EstadoDTE>> {
    // TODO: Módulo 2.1 — implementar consulta de estado vía SimpleAPI
    return { ok: false, error: new Error("Not implemented") }
  }

  async obtenerPDF(folio: number, tipo: number): Promise<Result<Buffer>> {
    // TODO: Módulo 2.2 — implementar descarga de PDF vía SimpleAPI
    return { ok: false, error: new Error("Not implemented") }
  }
}
