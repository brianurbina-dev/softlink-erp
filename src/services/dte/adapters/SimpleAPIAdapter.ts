import type {
  DTEService,
  DatosFactura,
  DatosBoleta,
  DatosNota,
  DatosGuia,
  ResultadoDTE,
  EstadoDTE,
  ItemFactura,
} from "../DTEService"
import type { Result } from "@/types"

// ─── Debug logger ──────────────────────────────────────────────────────────────
// Activar con DTE_DEBUG=true en .env

function isDteDebug() {
  return process.env.DTE_DEBUG === "true"
}

function dteLog(step: string, data: Record<string, unknown>) {
  if (!isDteDebug()) return
  const ts = new Date().toISOString()
  console.log(`\n${"─".repeat(60)}`)
  console.log(`[DTE DEBUG] ${ts} — ${step}`)
  console.log(JSON.stringify(data, null, 2))
}

function dteLogForm(step: string, url: string, inputJson: object, files: { field: string; name: string; sizeBytes: number; preview?: string }[]) {
  if (!isDteDebug()) return
  dteLog(`${step} → REQUEST`, {
    url,
    method: "POST",
    input: inputJson,
    files: files.map((f) => ({
      field: f.field,
      name: f.name,
      sizeBytes: f.sizeBytes,
      ...(f.preview ? { preview: f.preview } : {}),
    })),
  })
}

function dteLogResponse(step: string, status: number, body: string) {
  if (!isDteDebug()) return
  const MAX = 2000
  dteLog(`${step} ← RESPONSE`, {
    status,
    body: body.length > MAX ? body.slice(0, MAX) + `\n...(${body.length - MAX} chars truncados)` : body,
  })
}

interface AdapterConfig {
  apiKey: string
  ambiente: "certificacion" | "produccion"
  rutEmpresa: string
  rutCertificado: string
  razonSocial: string
  giro: string
  direccion: string
  comuna: string
  telefono: string
  actividadEconomica: number[]
  certPassword: string | null
  certBase64: string | null
  numeroResolucion: number
  fechaResolucion: string
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

  private authHeaders() {
    return { Authorization: this.cfg.apiKey }
  }

  private getCertBuffer(): Buffer | null {
    if (!this.cfg.certBase64) return null
    return Buffer.from(this.cfg.certBase64, "base64")
  }

  private buildCertificado() {
    return { Rut: this.cfg.rutCertificado || this.cfg.rutEmpresa, Password: this.cfg.certPassword ?? "" }
  }

  private buildEmisor() {
    // SII XSD sequence: RUTEmisor → RznSoc → GiroEmis → Acteco[] → DirOrigen → CmnaOrigen → Telefono[]
    // ActividadEconomica MUST appear before DireccionOrigen or the SII rejects with cvc-complex-type.2.4.a
    return {
      Rut: this.cfg.rutEmpresa,
      RazonSocial: this.cfg.razonSocial,
      Giro: this.cfg.giro,
      ActividadEconomica: this.cfg.actividadEconomica,
      DireccionOrigen: this.cfg.direccion || "Sin dirección",
      ComunaOrigen: this.cfg.comuna || "Sin comuna",
      Telefono: this.cfg.telefono ? [this.cfg.telefono] : [],
    }
  }

  private computeNeto(items: ItemFactura[]): number {
    return items.reduce((sum, i) => sum + Math.round(i.cantidad * i.precioUnitario), 0)
  }

  // ─── Step 1: DTE/generar → DTE XML ────────────────────────────────────────
  // cafField: "files" para facturas/notas/guías, "files2" para boletas

  private async generarDTE(
    inputJson: object,
    certBuffer: Buffer,
    cafXml: string,
    cafField: "files" | "files2" = "files"
  ): Promise<Result<string>> {
    const url = `${this.baseUrl}/api/v1/dte/generar`
    const cafBuffer = Buffer.from(cafXml, "utf-8")

    dteLogForm("PASO 1 — DTE/generar", url, inputJson, [
      { field: "files", name: "certificado.pfx", sizeBytes: certBuffer.length },
      { field: cafField, name: "caf.xml", sizeBytes: cafBuffer.length, preview: cafXml.slice(0, 300) },
    ])

    const form = new FormData()
    form.append("input", JSON.stringify(inputJson))
    form.append("files", new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }), "certificado.pfx")
    form.append(cafField, new Blob([cafBuffer], { type: "application/xml" }), "caf.xml")

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(30000),
      })

      const body = await res.text()
      dteLogResponse("PASO 1 — DTE/generar", res.status, body)

      if (!res.ok) {
        return { ok: false, error: new Error(`DTE/generar ${res.status}: ${body.slice(0, 300)}`) }
      }
      if (!body.includes("<DTE")) {
        return { ok: false, error: new Error(`DTE/generar respuesta inesperada: ${body.slice(0, 300)}`) }
      }
      return { ok: true, data: body }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      dteLog("PASO 1 — DTE/generar ERROR", { error: msg })
      return { ok: false, error: new Error(`DTE/generar: ${msg}`) }
    }
  }

  // ─── Step 2: Envio/generar → Sobre XML ────────────────────────────────────

  private async generarSobre(dteXml: string, certBuffer: Buffer): Promise<Result<string>> {
    const url = `${this.baseUrl}/api/v1/envio/generar`
    const input = {
      Certificado: this.buildCertificado(),
      Caratula: {
        RutEmisor: this.cfg.rutEmpresa,
        RutReceptor: "60803000-K",
        FechaResolucion: this.cfg.fechaResolucion,
        NumeroResolucion: this.cfg.numeroResolucion,
      },
    }
    const dteBuffer = Buffer.from(dteXml, "utf-8")

    dteLogForm("PASO 2 — Envio/generar", url, input, [
      { field: "files", name: "certificado.pfx", sizeBytes: certBuffer.length },
      { field: "files", name: "dte.xml", sizeBytes: dteBuffer.length, preview: dteXml.slice(0, 300) },
    ])

    const form = new FormData()
    form.append("input", JSON.stringify(input))
    form.append("files", new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }), "certificado.pfx")
    form.append("files", new Blob([dteBuffer], { type: "application/xml" }), "dte.xml")

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(30000),
      })

      const body = await res.text()
      dteLogResponse("PASO 2 — Envio/generar", res.status, body)

      if (!res.ok) {
        return { ok: false, error: new Error(`Envio/generar ${res.status}: ${body.slice(0, 300)}`) }
      }
      if (!body.includes("<EnvioDTE") && !body.includes("<SetDTE") && !body.includes("<EnvioBOLETA")) {
        return { ok: false, error: new Error(`Envio/generar respuesta inesperada: ${body.slice(0, 300)}`) }
      }
      return { ok: true, data: body }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      dteLog("PASO 2 — Envio/generar ERROR", { error: msg })
      return { ok: false, error: new Error(`Envio/generar: ${msg}`) }
    }
  }

  // ─── Step 3: Envio/enviar → TrackID ───────────────────────────────────────

  private async enviarSobre(sobreXml: string, certBuffer: Buffer, tipoEnvio: 1 | 2 = 1): Promise<Result<string>> {
    const url = `${this.baseUrl}/api/v1/envio/enviar`
    const input = {
      Certificado: this.buildCertificado(),
      Ambiente: this.ambienteNum,
      Tipo: tipoEnvio,
    }
    const sobreBuffer = Buffer.from(sobreXml, "utf-8")

    dteLogForm("PASO 3 — Envio/enviar", url, input, [
      { field: "files", name: "certificado.pfx", sizeBytes: certBuffer.length },
      { field: "files2", name: "sobre.xml", sizeBytes: sobreBuffer.length, preview: sobreXml.slice(0, 300) },
    ])

    const form = new FormData()
    form.append("input", JSON.stringify(input))
    form.append("files", new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }), "certificado.pfx")
    form.append("files2", new Blob([sobreBuffer], { type: "application/xml" }), "sobre.xml")

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(30000),
      })

      const rawBody = await res.text()
      dteLogResponse("PASO 3 — Envio/enviar", res.status, rawBody)

      if (!res.ok) {
        return { ok: false, error: new Error(`Envio/enviar ${res.status}: ${rawBody.slice(0, 300)}`) }
      }

      let json: Record<string, unknown>
      try {
        json = JSON.parse(rawBody) as Record<string, unknown>
      } catch {
        return { ok: false, error: new Error(`Envio/enviar respuesta no es JSON: ${rawBody.slice(0, 300)}`) }
      }

      const trackId = json.trackId ?? json.track_id
      if (!trackId && trackId !== 0) {
        return { ok: false, error: new Error(`Envio/enviar sin trackId: ${rawBody.slice(0, 300)}`) }
      }
      return { ok: true, data: String(trackId) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      dteLog("PASO 3 — Envio/enviar ERROR", { error: msg })
      return { ok: false, error: new Error(`Envio/enviar: ${msg}`) }
    }
  }

  // ─── Flujo completo de 3 pasos ─────────────────────────────────────────────

  private async emitir3Pasos(
    inputDte: object,
    folio: number,
    cafXml: string,
    cafField: "files" | "files2" = "files",
    tipoEnvio: 1 | 2 = 1
  ): Promise<Result<ResultadoDTE>> {
    const certBuffer = this.getCertBuffer()
    if (!certBuffer) {
      return { ok: false, error: new Error("No hay certificado digital configurado") }
    }

    dteLog("INICIO emitir3Pasos", {
      folio,
      ambiente: this.cfg.ambiente,
      rutEmpresa: this.cfg.rutEmpresa,
      certSizeBytes: certBuffer.length,
      cafPreview: cafXml.slice(0, 200),
    })

    const paso1 = await this.generarDTE(inputDte, certBuffer, cafXml, cafField)
    if (!paso1.ok) {
      dteLog("FALLO en paso 1", { error: paso1.error.message })
      return paso1
    }

    const paso2 = await this.generarSobre(paso1.data, certBuffer)
    if (!paso2.ok) {
      dteLog("FALLO en paso 2", { error: paso2.error.message })
      return paso2
    }

    const paso3 = await this.enviarSobre(paso2.data, certBuffer, tipoEnvio)
    if (!paso3.ok) {
      dteLog("FALLO en paso 3", { error: paso3.error.message })
      return paso3
    }

    dteLog("ÉXITO emitir3Pasos", { folio, trackId: paso3.data })
    return { ok: true, data: { folio, trackId: paso3.data, dteXml: paso1.data } }
  }

  // ─── Métodos públicos ──────────────────────────────────────────────────────

  async emitirFactura(datos: DatosFactura): Promise<Result<ResultadoDTE>> {
    const esAfecta = datos.tipo === 33
    const neto = this.computeNeto(datos.items)
    const montoNeto = esAfecta ? neto : 0
    const montoExento = esAfecta ? 0 : neto
    const iva = esAfecta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      Documento: {
        Encabezado: {
          IdentificacionDTE: {
            TipoDTE: datos.tipo,
            Folio: datos.folio,
            FechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
          },
          Emisor: this.buildEmisor(),
          Receptor: {
            Rut: datos.clienteRut,
            RazonSocial: datos.clienteRazonSocial,
            Giro: datos.clienteGiro,
            Direccion: datos.clienteDireccion,
            ...(datos.clienteComuna ? { Comuna: datos.clienteComuna } : {}),
            ...(datos.clienteContacto ? { Contacto: datos.clienteContacto } : {}),
          },
          Totales: {
            MontoNeto: montoNeto,
            MontoExento: montoExento,
            ...(esAfecta ? { TasaIVA: 19, IVA: iva } : {}),
            MontoTotal: montoTotal,
          },
        },
        Detalles: datos.items.map((item, i) => ({
          NumeroLinea: i + 1,
          Nombre: item.nombre,
          Cantidad: item.cantidad,
          Precio: item.precioUnitario,
          MontoItem: Math.round(item.cantidad * item.precioUnitario),
          ...(!esAfecta ? { IndicadorExento: 1 } : {}),
        })),
      },
      Certificado: this.buildCertificado(),
    }

    return this.emitir3Pasos(input, datos.folio, datos.cafXml)
  }

  async emitirBoleta(datos: DatosBoleta): Promise<Result<ResultadoDTE>> {
    // Para boletas, el precio unitario almacenado es NETO.
    // SimpleAPI espera Precio y MontoItem con IVA incluido (precio al consumidor).
    const neto = this.computeNeto(datos.items)
    const iva = Math.round(neto * 0.19)
    const montoTotal = neto + iva

    const input = {
      Documento: {
        Encabezado: {
          IdentificacionDTE: {
            TipoDTE: 39,
            Folio: datos.folio,
            FechaEmision: datos.fechaEmision.toISOString().split("T")[0],
            IndicadorServicio: 3,
          },
          // Boleta usa RazonSocialBoleta/GiroBoleta — sin ActividadEconomica ni Telefono
          Emisor: {
            Rut: this.cfg.rutEmpresa,
            RazonSocialBoleta: this.cfg.razonSocial,
            GiroBoleta: this.cfg.giro,
            DireccionOrigen: this.cfg.direccion || "Sin dirección",
            ComunaOrigen: this.cfg.comuna || "Sin comuna",
          },
          Receptor: {
            Rut: datos.receptorRut ?? "66666666-6",
            RazonSocial: datos.receptorNombre ?? "Consumidor Final",
          },
          // Boleta no lleva TasaIVA en Totales
          Totales: {
            MontoNeto: neto,
            IVA: iva,
            MontoTotal: montoTotal,
          },
        },
        // Precio y MontoItem van con IVA incluido (precio al consumidor final)
        Detalles: datos.items.map((item, i) => {
          const precioConIva = Math.round(item.precioUnitario * 1.19)
          return {
            NumeroLinea: i + 1,
            Nombre: item.nombre,
            Cantidad: item.cantidad,
            Precio: precioConIva,
            MontoItem: Math.round(item.cantidad * precioConIva),
          }
        }),
      },
      Certificado: this.buildCertificado(),
    }

    return this.emitir3Pasos(input, datos.folio, datos.cafXml, "files2", 2)
  }

  async emitirNota(datos: DatosNota): Promise<Result<ResultadoDTE>> {
    const esAfecta = datos.tipo === 56
    const neto = this.computeNeto(datos.items)
    const iva = esAfecta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      Documento: {
        Encabezado: {
          IdentificacionDTE: {
            TipoDTE: datos.tipo,
            Folio: datos.folio,
            FechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
          },
          Emisor: this.buildEmisor(),
          Receptor: {
            Rut: datos.clienteRut,
            RazonSocial: datos.clienteRazonSocial,
            Giro: datos.clienteGiro,
            Direccion: datos.clienteDireccion,
            ...(datos.clienteComuna ? { Comuna: datos.clienteComuna } : {}),
          },
          Totales: {
            MontoNeto: neto,
            ...(esAfecta ? { TasaIVA: 19, IVA: iva } : {}),
            MontoTotal: montoTotal,
          },
        },
        Detalles: datos.items.map((item, i) => ({
          NumeroLinea: i + 1,
          Nombre: item.nombre,
          Cantidad: item.cantidad,
          Precio: item.precioUnitario,
          MontoItem: Math.round(item.cantidad * item.precioUnitario),
        })),
        Referencias: [{ Folio: String(datos.referenciaFolio) }], //Pendiente de corrección 
      },
      Certificado: this.buildCertificado(),
    }

    return this.emitir3Pasos(input, datos.folio, datos.cafXml)
  }

  async emitirGuia(datos: DatosGuia): Promise<Result<ResultadoDTE>> {
    const esVenta = datos.tipoTraslado === 1
    const neto = this.computeNeto(datos.items)
    const iva = esVenta ? Math.round(neto * 0.19) : 0
    const montoTotal = neto + iva

    const input = {
      Documento: {
        Encabezado: {
          IdentificacionDTE: {
            TipoDTE: 52,
            Folio: datos.folio,
            FechaEmisionString: datos.fechaEmision.toISOString().split("T")[0],
            TipoDespacho: datos.tipoTraslado,
          },
          Emisor: this.buildEmisor(),
          ...(datos.clienteRut
            ? {
                Receptor: {
                  Rut: datos.clienteRut,
                  RazonSocial: datos.clienteRazonSocial,
                  Giro: datos.clienteGiro,
                  Direccion: datos.clienteDireccion,
                  ...(datos.clienteComuna ? { Comuna: datos.clienteComuna } : {}),
                },
              }
            : {}),
          ...(datos.transportistaRut || datos.patente
            ? {
                Transporte: {
                  RutTransportista: datos.transportistaRut,
                  Patente: datos.patente,
                  DireccionDestino: datos.direccionDestino,
                },
              }
            : {}),
          Totales: {
            MontoNeto: esVenta ? neto : 0,
            MontoExento: esVenta ? 0 : neto,
            ...(esVenta ? { TasaIVA: 19, IVA: iva } : {}),
            MontoTotal: montoTotal,
          },
        },
        Detalles: datos.items.map((item, i) => ({
          NumeroLinea: i + 1,
          Nombre: item.nombre,
          Cantidad: item.cantidad,
          Precio: item.precioUnitario,
          MontoItem: Math.round(item.cantidad * item.precioUnitario),
          ...(!esVenta ? { IndicadorExento: 1 } : {}),
        })),
        ...(datos.referenciaTipo && datos.referenciaFolio
          ? { Referencias: [{ Folio: String(datos.referenciaFolio) }] } //pendiente de correccion
          : {}),
      },
      Certificado: this.buildCertificado(),
    }

    return this.emitir3Pasos(input, datos.folio, datos.cafXml)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async anularDocumento(_folio: number, _tipo: number): Promise<Result<boolean>> {
    return { ok: false, error: new Error("Usar emitirNota con tipo 61") }
  }

  async testConexion(): Promise<Result<{ mensaje: string }>> {
    const certBuffer = this.getCertBuffer()
    if (!certBuffer) {
      return { ok: false, error: new Error("No hay certificado configurado para probar") }
    }
    const form = new FormData()
    form.append("input", JSON.stringify({}))
    form.append(
      "files",
      new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
      "certificado.pfx"
    )
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/dte/generar`, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(10000),
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: new Error("API key inválido o sin permisos") }
      }
      const env = this.cfg.ambiente === "produccion" ? "Producción" : "Certificación"
      return { ok: true, data: { mensaje: `Conexión exitosa con SimpleAPI (${env})` } }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`No se pudo conectar: ${msg}`) }
    }
  }

  async consultarEstado(trackId: string): Promise<Result<EstadoDTE>> {
    const certBuffer = this.getCertBuffer()
    if (!certBuffer) {
      return { ok: false, error: new Error("No hay certificado configurado") }
    }

    const input = {
      Certificado: this.buildCertificado(),
      RutEmpresa: this.cfg.rutEmpresa,
      TrackId: parseInt(trackId, 10),
      Ambiente: this.ambienteNum,
      ServidorBoletaREST: false,
    }

    const url = `${this.baseUrl}/api/v1/Consulta/envio`
    dteLog("consultarEstado → REQUEST", { url, trackId, input: { ...input, Certificado: { ...input.Certificado, Password: "***" } } })

    const form = new FormData()
    form.append("input", JSON.stringify(input))
    form.append("files", new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }), "certificado.pfx")

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: form,
        signal: AbortSignal.timeout(30000),
      })

      const rawBody = await res.text()
      dteLogResponse("consultarEstado", res.status, rawBody)

      if (!res.ok) {
        return { ok: false, error: new Error(`Consulta/envio ${res.status}: ${rawBody.slice(0, 300)}`) }
      }

      let json: Record<string, unknown>
      try {
        json = JSON.parse(rawBody) as Record<string, unknown>
      } catch {
        return { ok: false, error: new Error(`Consulta/envio respuesta no es JSON: ${rawBody.slice(0, 300)}`) }
      }

      // EstadoEnvioEmpresaEnum: 0=EnProceso, 1=Aceptado, 2=AceptadoConReparos, 3=Rechazado, 99=Error
      const estado = json.estadoRecepcionEnvio ?? json.estado ?? json.Estado
      if (estado === 1 || estado === 2) return { ok: true, data: "aceptado" }
      if (estado === 3) return { ok: true, data: "rechazado" }
      return { ok: true, data: "pendiente" }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red"
      return { ok: false, error: new Error(`consultarEstado: ${msg}`) }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async obtenerPDF(_folio: number, _tipo: number): Promise<Result<Buffer>> {
    return { ok: false, error: new Error("Not implemented") }
  }
}
