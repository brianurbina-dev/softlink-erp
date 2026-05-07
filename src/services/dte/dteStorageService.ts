import { uploadToR2, buildR2Key } from "@/services/storage/r2Service"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { extractAndGenerateBarcode } from "@/services/dte/tedBarcode"
import type { PdfDatosDTE, PdfEmisor, PdfReceptor, PdfItem } from "@/services/pdf/dtePdfGenerator"

export type DocTypeStorage = "facturas" | "boletas" | "guias" | "notas"

export interface StorageDTEInput {
  docType: DocTypeStorage
  docId: string
  tipo: number
  folio: number
  fecha: Date
  trackId: string
  dteXml?: string
  empresaRut: string
  emisor: PdfEmisor
  receptor: PdfReceptor
  items: PdfItem[]
  neto: number
  iva: number
  total: number
  tipoTraslado?: number
  referenciaFolio?: number
  referenciaTipo?: number
  referenciaRazon?: string
}

// Returns the API route URL to serve the PDF (stored in pdf_url column)
export async function storeDTE(input: StorageDTEInput): Promise<string | null> {
  const { tipo, folio, fecha, empresaRut, dteXml } = input

  // Upload XML if available (legal retention, internal)
  if (dteXml) {
    const xmlKey = buildR2Key(empresaRut, tipo, folio, fecha, "xml")
    await uploadToR2(xmlKey, Buffer.from(dteXml, "utf-8"), "application/xml")
  }

  // Generate PDF417 barcode from TED in DTE XML
  const tedBarcode = await extractAndGenerateBarcode(dteXml)

  // Generate and upload PDF
  const pdfData: PdfDatosDTE = {
    tipo: input.tipo,
    folio: input.folio,
    fecha: input.fecha,
    emisor: input.emisor,
    receptor: input.receptor,
    items: input.items,
    neto: input.neto,
    iva: input.iva,
    total: input.total,
    trackId: input.trackId,
    tedBarcode: tedBarcode ?? undefined,
    tipoTraslado: input.tipoTraslado,
    referenciaFolio: input.referenciaFolio,
    referenciaTipo: input.referenciaTipo,
    referenciaRazon: input.referenciaRazon,
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPdfDTE(pdfData)
  } catch (err) {
    console.error("[dteStorage] PDF generation failed:", err)
    return null
  }

  const pdfKey = buildR2Key(empresaRut, tipo, folio, fecha, "pdf")
  const uploaded = await uploadToR2(pdfKey, pdfBuffer, "application/pdf")

  if (!uploaded) return null

  // Return the API route that serves the PDF with a fresh signed URL
  return `/api/${input.docType}/${input.docId}/pdf`
}
