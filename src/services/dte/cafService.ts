import { Pool } from "pg"
import { prisma } from "@/lib/db/prisma"

const SIMPLEAPI_SERVICIOS_URL = "https://servicios.simpleapi.cl"

// Intentos en orden: si un intento supera 40 s, pasa al siguiente.
// El último (1 folio) tiene 120 s de timeout y es el límite mínimo garantizado.
const CAF_INTENTOS: Array<{ cantidad: number; timeoutMs: number }> = [
  // { cantidad: 10, timeoutMs: 40_000 }, de momento se deja en uno porque aun no se sabe si existen caf
  { cantidad: 1, timeoutMs: 140_000 },
]

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export interface CafRow {
  id: string
  tipoDte: number
  folioDesde: number
  folioHasta: number
  folioActual: number
  folioPendiente: number | null
  activo: boolean
  creadoEn: Date
}

/** Parsea el XML de un CAF para extraer tipo DTE y rango de folios. */
export function parseCafXml(xml: string): { tipoDte: number; folioDesde: number; folioHasta: number } {
  const td = xml.match(/<TD>(\d+)<\/TD>/)?.[1]
  const desde = xml.match(/<D>(\d+)<\/D>/)?.[1]
  const hasta = xml.match(/<H>(\d+)<\/H>/)?.[1]

  if (!td || !desde || !hasta) {
    throw new Error("XML de CAF inválido: faltan campos TD, D o H")
  }

  return {
    tipoDte: parseInt(td, 10),
    folioDesde: parseInt(desde, 10),
    folioHasta: parseInt(hasta, 10),
  }
}

/** Guarda un CAF en la tabla de la empresa. Reemplaza el CAF activo del mismo tipo si lo hay. */
export async function guardarCaf(schemaName: string, xmlContenido: string): Promise<CafRow> {
  const { tipoDte, folioDesde, folioHasta } = parseCafXml(xmlContenido)

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")

    // Desactivar CAFs anteriores del mismo tipo
    await client.query(
      `UPDATE "${schemaName}".caf SET activo = false WHERE tipo_dte = $1`,
      [tipoDte]
    )

    const { rows } = await client.query<{
      id: string
      tipo_dte: number
      folio_desde: number
      folio_hasta: number
      folio_actual: number
      activo: boolean
      creado_en: Date
    }>(
      `INSERT INTO "${schemaName}".caf
         (tipo_dte, folio_desde, folio_hasta, folio_actual, xml_contenido, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, tipo_dte, folio_desde, folio_hasta, folio_actual, activo, creado_en`,
      [tipoDte, folioDesde, folioHasta, folioDesde, xmlContenido]
    )

    await client.query("COMMIT")
    const r = rows[0]
    return {
      id: r.id,
      tipoDte: r.tipo_dte,
      folioDesde: r.folio_desde,
      folioHasta: r.folio_hasta,
      folioActual: r.folio_actual,
      folioPendiente: null,
      activo: r.activo,
      creadoEn: r.creado_en,
    }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/** Devuelve el XML completo de un CAF por id. */
export async function getCafXml(schemaName: string, cafId: string): Promise<string | null> {
  const { rows } = await getPool().query<{ xml_contenido: string }>(
    `SELECT xml_contenido FROM "${schemaName}".caf WHERE id = $1`,
    [cafId]
  )
  return rows[0]?.xml_contenido ?? null
}

/** Lista todos los CAFs de la empresa. */
export async function listarCafs(schemaName: string): Promise<CafRow[]> {
  const { rows } = await getPool().query<{
    id: string
    tipo_dte: number
    folio_desde: number
    folio_hasta: number
    folio_actual: number
    folio_pendiente: number | null
    activo: boolean
    creado_en: Date
  }>(
    `SELECT id, tipo_dte, folio_desde, folio_hasta, folio_actual, folio_pendiente, activo, creado_en
     FROM "${schemaName}".caf
     ORDER BY tipo_dte, creado_en DESC`
  )

  return rows.map((r) => ({
    id: r.id,
    tipoDte: r.tipo_dte,
    folioDesde: r.folio_desde,
    folioHasta: r.folio_hasta,
    folioActual: r.folio_actual,
    folioPendiente: r.folio_pendiente,
    activo: r.activo,
    creadoEn: r.creado_en,
  }))
}

/** Elimina un CAF por id. */
export async function eliminarCaf(schemaName: string, cafId: string): Promise<void> {
  await getPool().query(`DELETE FROM "${schemaName}".caf WHERE id = $1`, [cafId])
}

/**
 * Anula un rango de folios en el SII vía SimpleAPI.
 * Usar cuando hay folios autorizados que no se enviarán al SII.
 */
export async function anularFolios(
  tipoDte: number,
  folioDesde: number,
  folioHasta: number,
  cfg: SolicitarCafConfig
): Promise<void> {
  const isDebug = process.env.DTE_DEBUG === "true"
  const url = `${SIMPLEAPI_SERVICIOS_URL}/api/folios/anulacion/${tipoDte}/${folioDesde}/${folioHasta}`
  const certBuffer = Buffer.from(cfg.certBase64, "base64")

  const input = {
    RutCertificado: cfg.rutCertificado,
    Password: cfg.certPassword,
    RutEmpresa: cfg.rutEmpresa,
    Ambiente: cfg.ambiente,
    MotivoAnulacion: "Folio no utilizado en emisión DTE",
  }

  if (isDebug) {
    console.log(`[DTE DEBUG] anularFolios → tipo=${tipoDte} desde=${folioDesde} hasta=${folioHasta}`)
  }

  const form = new FormData()
  form.append("input", JSON.stringify(input))
  form.append(
    "files",
    new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
    "certificado.pfx"
  )

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: cfg.apiKey },
    body: form,
    signal: AbortSignal.timeout(130_000),
  })
  const body = await res.text()

  if (isDebug) {
    console.log(`[DTE DEBUG] anularFolios ← status=${res.status} body=${body.slice(0, 200)}`)
  }

  if (!res.ok) {
    throw new Error(`Error al anular folios ${folioDesde}-${folioHasta} tipo ${tipoDte}: ${body.slice(0, 200)}`)
  }
}

/**
 * Anula en el SII todos los CAFs inactivos de la empresa para el tipo DTE dado.
 * Se llama automáticamente cuando el SII bloquea nuevas solicitudes de CAF
 * por tener folios autorizados sin usar.
 */
async function anularCafsInactivos(
  schemaName: string,
  tipoDte: number,
  cfg: SolicitarCafConfig
): Promise<void> {
  const { rows } = await getPool().query<{ folio_desde: number; folio_hasta: number }>(
    `SELECT folio_desde, folio_hasta FROM "${schemaName}".caf
     WHERE tipo_dte = $1 AND activo = false
     ORDER BY folio_desde`,
    [tipoDte]
  )

  for (const { folio_desde, folio_hasta } of rows) {
    await anularFolios(tipoDte, folio_desde, folio_hasta, cfg)
  }
}

/**
 * Reserva atómicamente el siguiente folio disponible para el tipo DTE dado.
 * Si hay un folio_pendiente (emisión anterior fallida), lo reutiliza en vez de consumir uno nuevo.
 * Devuelve null si no hay CAF activo con folios disponibles.
 */
export async function reservarFolio(
  schemaName: string,
  tipoDte: number
): Promise<{ folio: number; cafXml: string } | null> {
  const { rows } = await getPool().query<{ folio: number; xml_contenido: string }>(
    `WITH sel AS (
       SELECT id, folio_pendiente, folio_actual, folio_hasta
       FROM "${schemaName}".caf
       WHERE tipo_dte = $1
         AND activo = true
         AND (folio_actual <= folio_hasta OR folio_pendiente IS NOT NULL)
       ORDER BY folio_hasta ASC
       LIMIT 1
       FOR UPDATE
     )
     UPDATE "${schemaName}".caf c
     SET
       folio_actual    = CASE WHEN sel.folio_pendiente IS NULL THEN c.folio_actual + 1 ELSE c.folio_actual END,
       folio_pendiente = COALESCE(sel.folio_pendiente, c.folio_actual)
     FROM sel
     WHERE c.id = sel.id
     RETURNING c.folio_pendiente AS folio, c.xml_contenido`,
    [tipoDte]
  )

  if (rows.length === 0) return null

  const { folio, xml_contenido } = rows[0]

  // Marcar como inactivo si se agotó y no queda pendiente que confirmar
  await getPool().query(
    `UPDATE "${schemaName}".caf
     SET activo = false
     WHERE tipo_dte = $1 AND activo = true AND folio_actual > folio_hasta AND folio_pendiente IS NULL`,
    [tipoDte]
  )

  return { folio, cafXml: xml_contenido }
}

/**
 * Confirma que el folio pendiente fue emitido exitosamente al SII.
 * Limpia folio_pendiente y marca el CAF como inactivo si ya no quedan folios.
 * Llamar siempre después de una emisión exitosa.
 */
export async function confirmarFolio(schemaName: string, tipoDte: number): Promise<void> {
  await getPool().query(
    `UPDATE "${schemaName}".caf
     SET
       folio_pendiente = NULL,
       activo = CASE WHEN folio_actual > folio_hasta THEN false ELSE activo END
     WHERE tipo_dte = $1 AND activo = true AND folio_pendiente IS NOT NULL`,
    [tipoDte]
  )
}

/**
 * Solicita un CAF nuevo al SII vía SimpleAPI y lo guarda en la empresa.
 * Se llama automáticamente cuando no hay folios disponibles.
 */
interface SolicitarCafConfig {
  apiKey: string
  rutEmpresa: string
  rutCertificado: string
  certPassword: string
  certBase64: string
  ambiente: number  // 0 = certificacion, 1 = produccion
}

/**
 * Solicita un CAF al SII vía SimpleAPI y lo guarda en la empresa.
 * POST multipart con input JSON + archivo PFX.
 */
export async function solicitarCaf(
  schemaName: string,
  tipoDte: number,
  cfg: SolicitarCafConfig
): Promise<CafRow> {
  const isDebug = process.env.DTE_DEBUG === "true"
  const certBuffer = Buffer.from(cfg.certBase64, "base64")

  const input = {
    RutCertificado: cfg.rutCertificado,
    Password: cfg.certPassword,
    RutEmpresa: cfg.rutEmpresa,
    Ambiente: cfg.ambiente,
  }

  let lastError = ""
  let anulacionRealizada = false

  // Hasta 2 pasadas: la segunda ocurre si el SII bloquea por folios sin usar y auto-anulamos.
  for (let pasada = 0; pasada < 2; pasada++) {
    for (const { cantidad, timeoutMs } of CAF_INTENTOS) {
      const url = `${SIMPLEAPI_SERVICIOS_URL}/api/folios/get/${tipoDte}/${cantidad}`

      if (isDebug) {
        console.log(`\n${"─".repeat(60)}`)
        console.log(`[DTE DEBUG] solicitarCaf → REQUEST (pasada=${pasada + 1}, cantidad=${cantidad}, timeout=${timeoutMs}ms)`)
        console.log(JSON.stringify({
          url,
          method: "POST",
          input: { ...input, Password: "***" },
          files: [{ field: "files", name: "certificado.pfx", sizeBytes: certBuffer.length }],
        }, null, 2))
      }

      const form = new FormData()
      form.append("input", JSON.stringify(input))
      form.append(
        "files",
        new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
        "certificado.pfx"
      )

      let res: Response
      let body: string
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: cfg.apiKey },
          body: form,
          signal: AbortSignal.timeout(timeoutMs),
        })
        body = await res.text()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isTimeout = msg.includes("timeout") || msg.includes("aborted") || msg.includes("abort")
        if (isDebug) console.log(`[DTE DEBUG] solicitarCaf ← ${isTimeout ? "TIMEOUT" : "NETWORK ERROR"} (cantidad=${cantidad}): ${msg}`)

        if (isTimeout && cantidad > 1) {
          lastError = `Timeout con cantidad=${cantidad}`
          continue
        }
        throw new Error(`No se pudo conectar a servicios.simpleapi.cl: ${msg}`)
      }

      if (isDebug) {
        console.log(`[DTE DEBUG] solicitarCaf ← RESPONSE (cantidad=${cantidad})`)
        console.log(JSON.stringify({
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: body.slice(0, 1000),
        }, null, 2))
      }

      if (!res.ok) {
        // SII bloqueado por folios autorizados sin usar → auto-anular y reintentar UNA vez
        const bloqueadoPorFolios = /folios suficiente|timbraje electr/i.test(body)
        if (bloqueadoPorFolios && !anulacionRealizada) {
          anulacionRealizada = true
          if (isDebug) console.log(`[DTE DEBUG] SII bloqueado por folios pendientes — anulando CAFs inactivos...`)
          await anularCafsInactivos(schemaName, tipoDte, cfg)
          break // Salir del loop de cantidades y reiniciar con pasada 2
        }
        throw new Error(`Error al solicitar CAF al SII (tipo ${tipoDte}): ${res.status} — ${body.slice(0, 300)}`)
      }
      if (!body.includes("<CAF")) {
        throw new Error(`Respuesta inesperada al solicitar CAF: ${body.slice(0, 300)}`)
      }

      return guardarCaf(schemaName, body)
    }

    // Si llegamos aquí en la primera pasada sin anulación, se agotaron los intentos
    if (!anulacionRealizada) break
  }

  throw new Error(`No se pudo solicitar CAF tras todos los intentos. Último error: ${lastError}`)
}

/**
 * Reserva el siguiente folio para el tipo DTE dado.
 * Si no hay CAF activo o está agotado, lo solicita automáticamente al SII.
 * Lanza error si no hay API key configurado o falla la solicitud al SII.
 */
export async function ensureFolio(
  schemaName: string,
  tipoDte: number,
  empresaId: string
): Promise<{ folio: number; cafXml: string }> {
  // Intentar con CAF existente
  const existente = await reservarFolio(schemaName, tipoDte)
  if (existente) return existente

  // Sin folios disponibles — solicitar CAF automáticamente al SII
  const [config, empresa] = await Promise.all([
    prisma.dteConfig.findUnique({ where: { empresaId } }),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
  ])

  if (!config?.apiKey) {
    throw new Error("No hay API key DTE configurado. Ve a Configuración → DTE para agregarlo.")
  }
  if (!config.certificado || !config.certificadoPassword) {
    throw new Error("No hay certificado digital configurado. Ve a Configuración → DTE para subirlo.")
  }
  if (!empresa) {
    throw new Error("Empresa no encontrada.")
  }

  await solicitarCaf(schemaName, tipoDte, {
    apiKey: config.apiKey,
    rutEmpresa: empresa.rut,
    rutCertificado: config.rutCertificado ?? empresa.rut,
    certPassword: config.certificadoPassword,
    certBase64: config.certificado,
    ambiente: config.ambiente === "produccion" ? 1 : 0,
  })

  const nuevo = await reservarFolio(schemaName, tipoDte)
  if (!nuevo) {
    throw new Error(`No se pudo obtener un folio para tipo DTE ${tipoDte} tras solicitar CAF nuevo.`)
  }
  return nuevo
}
