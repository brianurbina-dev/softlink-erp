import { prisma } from "@/lib/db/prisma"
import { buildR2Key, downloadBinaryFromR2 } from "@/services/storage/r2Service"
import { getResendClient, RESEND_FROM_EMAIL } from "./resendClient"
import { buildDteEmailHtml } from "./dteEmailTemplate"

export interface SendDteEmailParams {
  schemaName: string
  // Documento
  documentoTipo: "factura" | "boleta" | "guia" | "nota"
  documentoId: string
  tipoDte: number
  folio: number
  fecha: Date
  trackId: string
  // Partes
  emisorNombre: string
  emisorRut: string
  receptorNombre: string
  receptorRut: string
  receptorEmail: string | null | undefined
  // Detalle
  items: { descripcion: string; cantidad: number; precioUnitario: number; monto: number }[]
  neto: number
  iva: number
  total: number
  // R2 para adjuntar PDF
  empresaRut: string
}

const TIPO_LABELS: Record<number, string> = {
  33: "Factura Afecta Electrónica",
  34: "Factura Exenta Electrónica",
  39: "Boleta Electrónica",
  52: "Guía de Despacho Electrónica",
  56: "Nota de Débito Electrónica",
  61: "Nota de Crédito Electrónica",
}

const TIPO_PATH: Record<string, string> = {
  factura: "facturas",
  boleta: "boletas",
  guia: "guias",
  nota: "notas",
}

export async function sendDteEmail(p: SendDteEmailParams): Promise<void> {
  if (!p.receptorEmail) {
    await _log({
      schemaName: p.schemaName,
      documentoTipo: p.documentoTipo,
      documentoId: p.documentoId,
      tipoDte: p.tipoDte,
      folio: p.folio,
      destinatario: "sin_destinatario",
      asunto: "",
      estado: "sin_destinatario",
      resendId: null,
      errorMensaje: "El receptor no tiene email registrado",
    })
    return
  }

  const resend = getResendClient()
  if (!resend) {
    await _log({
      schemaName: p.schemaName,
      documentoTipo: p.documentoTipo,
      documentoId: p.documentoId,
      tipoDte: p.tipoDte,
      folio: p.folio,
      destinatario: p.receptorEmail,
      asunto: "",
      estado: "fallido",
      resendId: null,
      errorMensaje: "RESEND_API_KEY no configurado",
    })
    return
  }

  const tipoLabel = TIPO_LABELS[p.tipoDte] ?? `DTE Tipo ${p.tipoDte}`
  const asunto = `${tipoLabel} N° ${p.folio} — ${p.emisorNombre}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://softlinkerp.cl"

  const html = buildDteEmailHtml({
    tipoLabel,
    folio: p.folio,
    fecha: p.fecha,
    emisorNombre: p.emisorNombre,
    emisorRut: p.emisorRut,
    receptorNombre: p.receptorNombre,
    receptorRut: p.receptorRut,
    items: p.items,
    neto: p.neto,
    iva: p.iva,
    total: p.total,
    trackId: p.trackId,
    appUrl,
    documentoTipoPath: TIPO_PATH[p.documentoTipo] ?? p.documentoTipo,
  })

  // Intentar adjuntar el PDF desde R2
  const pdfKey = buildR2Key(p.empresaRut, p.tipoDte, p.folio, p.fecha, "pdf")
  const pdfBuffer = await downloadBinaryFromR2(pdfKey)

  const attachments = pdfBuffer
    ? [
        {
          filename: `${tipoLabel.replace(/\s+/g, "_")}_${p.folio}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : []

  let resendId: string | null = null
  let estado: "enviado" | "fallido" = "enviado"
  let errorMensaje: string | null = null

  try {
    const from = `${p.emisorNombre} vía Softlink ERP <${RESEND_FROM_EMAIL}>`
    const response = await resend.emails.send({
      from,
      to: [p.receptorEmail],
      subject: asunto,
      html,
      attachments,
    })

    if (response.error) {
      estado = "fallido"
      errorMensaje = response.error.message
    } else {
      resendId = response.data?.id ?? null
    }
  } catch (err) {
    estado = "fallido"
    errorMensaje = err instanceof Error ? err.message : "Error desconocido al enviar"
  }

  await _log({
    schemaName: p.schemaName,
    documentoTipo: p.documentoTipo,
    documentoId: p.documentoId,
    tipoDte: p.tipoDte,
    folio: p.folio,
    destinatario: p.receptorEmail,
    asunto,
    estado,
    resendId,
    errorMensaje,
  })
}

interface LogParams {
  schemaName: string
  documentoTipo: string
  documentoId: string
  tipoDte: number
  folio: number
  destinatario: string
  asunto: string
  estado: "enviado" | "fallido" | "sin_destinatario"
  resendId: string | null
  errorMensaje: string | null
}

async function _log(p: LogParams): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${p.schemaName}".email_logs
         (documento_tipo, documento_id, tipo_dte, folio, destinatario, asunto, estado, resend_id, error_mensaje)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
      p.documentoTipo,
      p.documentoId,
      p.tipoDte,
      p.folio,
      p.destinatario,
      p.asunto,
      p.estado,
      p.resendId,
      p.errorMensaje
    )
  } catch {
    // No interrumpir el flujo si falla el log
  }
}
