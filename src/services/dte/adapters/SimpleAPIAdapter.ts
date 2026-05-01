import type { DTEService, DatosFactura, DatosBoleta, DatosNota, DatosGuia, ResultadoDTE, EstadoDTE, ItemFactura } from "../DTEService"
import type { Result } from "@/types"

interface AdapterConfig {
  apiKey: string
  ambiente: "certificacion" | "produccion"
  rutEmpresa: string
  razonSocial: string
  certPassword: string | null
  certBase64: string | null
}

export class SimpleAPIAdapter implements DTEService {
  private readonly baseUrl: string
  private readonly cfg: AdapterConfig

  constructor(cfg: AdapterConfig) {
    this.baseUrl = process.env.SIMPLEAPI_BASE_URL ?? "https://api.simpleapi.cl"
    this.cfg = cfg
  }

  private get ambienteNum() {
    return this.cfg.ambiente === "produccion" ? 1 : 0
  }

  // SimpleAPI autenticación: Basic Auth con "api:<apikey>" codificado en base64
  private authHeaders() {
    const encoded = Buffer.from(`api:${this.cfg.apiKey}`).toString("base64")
    return { Authorization: `Basic ${encoded}` }
  }

  private getCertBuffer(): Buffer | null {
    if (!this.cfg.certBase64) return null
    return Buffer.from(this.cfg.certBase64, "base64")
  }

  private buildCertificado() {
    return {
      rut: this.cfg.rutEmpresa,
      password: this.cfg.certPassword ?? "",
    }
  }

  private buildForm(input: object, certBuffer: Buffer | null): FormData {
    const form = new FormData()
    form.append("input", JSON.stringify(input))
    if (certBuffer) {
      form.append(
        "files",
        new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
        "certificado.pfx"
      )
    }
    return form
  }

  private computeNeto(items: ItemFactura[]): number {
    return items.reduce((sum, i) => sum + Math.round(i.cantidad * i.precioUnitario), 0)
  }

  private parseResultado(json: Record<string, unknown>): ResultadoDTE {
    // SimpleAPI puede envolver la respuesta en .data o directamente
    const d = (json.data ?? json) as Record<string, unknown>
    return {
      folio: (d.folio ?? json.folio ?? 0) as number,
      trackId: String(d.trackId ?? d.track_id ?? json.trackId ?? json.track_id ?? d.folio ?? ""),
      pdfUrl: (d.pdfUrl ?? d.pdf_url ?? json.pdfUrl) as string | undefined,
      xmlUrl: (d.xmlUrl ?? d.xml_url ?? json.xmlUrl) as string | undefined,
    }
  }

  private async handleResponse(res: Response): Promise<Result<ResultadoDTE>> {
    if (!res.ok) {
      let errorMsg = `Error ${res.status}`
      try {
        const body = await res.json() as Record<string, unknown>
        const msg = (body.error ?? body.message ?? body.mensaje) as string | undefined
        if (msg) errorMsg = msg
      } catch { /* body no es JSON */ }
      return { ok: false, error: new Error(errorMsg) }
    }
    const json = await res.json() as Record<string, unknown>
    return { ok: true, data: this.parseResultado(json) }
  }

  async testConexion(): Promise<Result<{ mensaje: string }>> {
    try {
      // El endpoint /api/auth/token no valida el key (siempre devuelve 200).
      // La única validación real es intentar llamar a un endpoint DTE con Basic Auth:
      // clave válida → 400 (payload inválido), clave inválida → 401.
      const form = new FormData()
      const res = await fetch(`${this.baseUrl}/api/v1/DTE/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(10000),
      })

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: new Error("API key inválido o sin permisos") }
      }

      // Cualquier otra respuesta (400 payload inválido, 422, 500) significa que el key fue aceptado
      const env = this.cfg.ambiente === "produccion" ? "Producción" : "Certificación"
      return { ok: true, data: { mensaje: `Conexión exitosa con SimpleAPI (${env})` } }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`No se pudo conectar con SimpleAPI: ${msg}`) }
    }
  }

  async emitirFactura(datos: DatosFactura): Promise<Result<ResultadoDTE>> {
    const certBuffer = this.getCertBuffer()
    const esAfecta = datos.tipo === 33

    const neto = this.computeNeto(datos.items)
    const montoNeto = esAfecta ? neto : 0
    const montoExento = esAfecta ? 0 : neto
    const iva = esAfecta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      documento: {
        encabezado: {
          identificacionDTE: {
            tipoDTE: datos.tipo,
            fechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
          },
          emisor: {
            rut: this.cfg.rutEmpresa,
            razonSocial: this.cfg.razonSocial,
          },
          receptor: {
            rut: datos.clienteRut,
            razonSocial: datos.clienteRazonSocial,
            giro: datos.clienteGiro,
            direccion: datos.clienteDireccion,
          },
          totales: {
            montoNeto,
            montoExento,
            ...(esAfecta ? { tasaIVA: 19, iva } : {}),
            montoTotal,
          },
        },
        detalles: datos.items.map((item, i) => ({
          numeroLinea: i + 1,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
          montoItem: Math.round(item.cantidad * item.precioUnitario),
          ...(!esAfecta ? { indicadorExento: 1 } : {}),
        })),
      },
      certificado: this.buildCertificado(),
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/DTE/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: this.buildForm(input, certBuffer),
        signal: AbortSignal.timeout(30000),
      })
      return this.handleResponse(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`Error al emitir factura: ${msg}`) }
    }
  }

  async emitirBoleta(datos: DatosBoleta): Promise<Result<ResultadoDTE>> {
    const certBuffer = this.getCertBuffer()
    const neto = this.computeNeto(datos.items)
    const iva = Math.round(neto * 0.19)
    const montoTotal = neto + iva

    const input = {
      documento: {
        encabezado: {
          identificacionDTE: {
            tipoDTE: 39,
            fechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
          },
          emisor: {
            rut: this.cfg.rutEmpresa,
            razonSocial: this.cfg.razonSocial,
          },
          ...(datos.receptorRut
            ? {
                receptor: {
                  rut: datos.receptorRut,
                  razonSocial: datos.receptorNombre,
                },
              }
            : {}),
          totales: {
            montoNeto: neto,
            tasaIVA: 19,
            iva,
            montoTotal,
          },
        },
        detalles: datos.items.map((item, i) => ({
          numeroLinea: i + 1,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
          montoItem: Math.round(item.cantidad * item.precioUnitario),
        })),
      },
      certificado: this.buildCertificado(),
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/DTE/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: this.buildForm(input, certBuffer),
        signal: AbortSignal.timeout(30000),
      })
      return this.handleResponse(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`Error al emitir boleta: ${msg}`) }
    }
  }

  async emitirNota(datos: DatosNota): Promise<Result<ResultadoDTE>> {
    const certBuffer = this.getCertBuffer()
    const esAfecta = datos.tipo === 56
    const neto = this.computeNeto(datos.items)
    const iva = esAfecta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      documento: {
        encabezado: {
          identificacionDTE: {
            tipoDTE: datos.tipo,
            fechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
          },
          emisor: {
            rut: this.cfg.rutEmpresa,
            razonSocial: this.cfg.razonSocial,
          },
          receptor: {
            rut: datos.clienteRut,
            razonSocial: datos.clienteRazonSocial,
            giro: datos.clienteGiro,
            direccion: datos.clienteDireccion,
          },
          totales: {
            montoNeto: neto,
            ...(esAfecta ? { tasaIVA: 19, iva } : {}),
            montoTotal,
          },
        },
        detalles: datos.items.map((item, i) => ({
          numeroLinea: i + 1,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
          montoItem: Math.round(item.cantidad * item.precioUnitario),
        })),
        referencias: [
          {
            numero: 1,
            tipoDocumento: String(datos.referenciaTipo),
            folio: datos.referenciaFolio,
            razonRef: datos.referenciaRazon,
          },
        ],
      },
      certificado: this.buildCertificado(),
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/DTE/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: this.buildForm(input, certBuffer),
        signal: AbortSignal.timeout(30000),
      })
      return this.handleResponse(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`Error al emitir nota: ${msg}`) }
    }
  }

  async emitirGuia(datos: DatosGuia): Promise<Result<ResultadoDTE>> {
    const certBuffer = this.getCertBuffer()
    const esVenta = datos.tipoTraslado === 1
    const neto = this.computeNeto(datos.items)
    const iva = esVenta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      documento: {
        encabezado: {
          identificacionDTE: {
            tipoDTE: 52,
            fechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
            tipoDespacho: datos.tipoTraslado,
          },
          emisor: {
            rut: this.cfg.rutEmpresa,
            razonSocial: this.cfg.razonSocial,
          },
          ...(datos.clienteRut
            ? {
                receptor: {
                  rut: datos.clienteRut,
                  razonSocial: datos.clienteRazonSocial,
                  giro: datos.clienteGiro,
                  direccion: datos.clienteDireccion,
                },
              }
            : {}),
          ...(datos.transportistaRut || datos.patente
            ? {
                transporte: {
                  rutTransportista: datos.transportistaRut,
                  patente: datos.patente,
                  direccionDestino: datos.direccionDestino,
                },
              }
            : {}),
          totales: {
            montoNeto: esVenta ? neto : 0,
            montoExento: esVenta ? 0 : neto,
            ...(esVenta ? { tasaIVA: 19, iva } : {}),
            montoTotal,
          },
        },
        detalles: datos.items.map((item, i) => ({
          numeroLinea: i + 1,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
          montoItem: Math.round(item.cantidad * item.precioUnitario),
          ...(!esVenta ? { indicadorExento: 1 } : {}),
        })),
      },
      certificado: this.buildCertificado(),
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/DTE/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: this.buildForm(input, certBuffer),
        signal: AbortSignal.timeout(30000),
      })
      return this.handleResponse(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`Error al emitir guía: ${msg}`) }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async anularDocumento(_folio: number, _tipo: number): Promise<Result<boolean>> {
    return { ok: false, error: new Error("Usar emitirNota con tipo 61") }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async consultarEstado(_trackId: string): Promise<Result<EstadoDTE>> {
    return { ok: false, error: new Error("Not implemented") }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async obtenerPDF(_folio: number, _tipo: number): Promise<Result<Buffer>> {
    return { ok: false, error: new Error("Not implemented") }
  }
}
