import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getEmpresaContext } from "@/lib/db/get-empresa-context"
import { generarPdfDTE } from "@/services/pdf/dtePdfGenerator"
import { uploadToR2, getSignedDownloadUrl, resolveLogoUrl } from "@/services/storage/r2Service"
import { getR2Client, getR2Bucket } from "@/lib/r2/client"

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1 — Verificar variables de entorno R2
  results.env = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? "✓ presente" : "✗ falta",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? "✓ presente" : "✗ falta",
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? "✓ presente" : "✗ falta",
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME ?? "✗ falta",
  }

  // 2 — Verificar cliente R2
  const client = getR2Client()
  results.r2_client = client ? "✓ cliente creado" : "✗ no se pudo crear (faltan env vars)"
  results.r2_bucket = getR2Bucket() || "✗ sin bucket"

  // 3 — Leer datos reales de la empresa logueada (si hay sesión)
  const ctx = await getEmpresaContext()
  let logoUrl: string | undefined
  let emisorRut = "76.000.000-0"
  let emisorNombre = "Empresa de Prueba SpA"
  let emisorGiro = "Actividades de prueba"
  let emisorDir = "Av. Providencia 123"
  let emisorCiudad = "Santiago"
  let emisorTel = "+56 9 1234 5678"
  let numResolucion = 80
  let fechaResolucion = "2014-09-22"

  if (ctx) {
    const [empresa, config] = await Promise.all([
      prisma.empresa.findUnique({ where: { id: ctx.empresaId } }),
      prisma.dteConfig.findUnique({ where: { empresaId: ctx.empresaId } }),
    ])
    if (empresa) {
      emisorRut = empresa.rut
      emisorNombre = empresa.razonSocial
      emisorGiro = empresa.giro ?? emisorGiro
      emisorDir = empresa.direccion ?? emisorDir
      emisorCiudad = empresa.ciudad ?? emisorCiudad
      emisorTel = empresa.telefono ?? emisorTel
      numResolucion = config?.numeroResolucion ?? numResolucion
      fechaResolucion = config?.fechaResolucion ?? fechaResolucion
      logoUrl = await resolveLogoUrl(empresa.logoUrl)
      results.empresa = `✓ ${empresa.razonSocial} (${empresa.rut})`
      results.logo = logoUrl ? "✓ logo resuelto desde R2" : "— sin logo configurado"
    }
  } else {
    results.empresa = "— sin sesión, usando datos de prueba"
    results.logo = "— sin sesión"
  }

  // 4 — Generar PDF con los datos de la empresa (reales o de prueba)
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generarPdfDTE({
      tipo: 33,
      folio: 999,
      fecha: new Date(),
      emisor: {
        rut: emisorRut,
        razonSocial: emisorNombre,
        giro: emisorGiro,
        direccion: emisorDir,
        ciudad: emisorCiudad,
        telefono: emisorTel,
        numeroResolucion: numResolucion,
        fechaResolucion: fechaResolucion,
        logoUrl,
      },
      receptor: {
        rut: "12.345.678-9",
        razonSocial: "Cliente de Prueba",
        giro: "Comercio",
        direccion: "Las Condes 456",
        ciudad: "Las Condes",
      },
      items: [
        { descripcion: "Servicio de prueba", cantidad: 1, precioUnitario: 100000, monto: 100000 },
        { descripcion: "Producto de prueba", cantidad: 2, precioUnitario: 25000, monto: 50000 },
      ],
      neto: 150000,
      iva: 28500,
      total: 178500,
      trackId: "TEST-TRACK-12345",
    })
    results.pdf_generado = `✓ ${pdfBuffer.length.toLocaleString()} bytes`
  } catch (err) {
    results.pdf_generado = `✗ Error: ${err instanceof Error ? err.message : String(err)}`
    return NextResponse.json(results, { status: 500 })
  }

  // 5 — Subir a R2
  const testKey = `test/pdf-test-${Date.now()}.pdf`
  const uploaded = await uploadToR2(testKey, pdfBuffer, "application/pdf")
  results.r2_upload = uploaded ? `✓ subido como ${testKey}` : "✗ falló la subida (ver consola del servidor)"

  if (!uploaded) {
    return NextResponse.json(results, { status: 500 })
  }

  // 6 — Obtener URL firmada
  const signedUrl = await getSignedDownloadUrl(testKey, 300)
  results.signed_url = signedUrl ? "✓ URL generada (5 min de validez)" : "✗ no se pudo generar URL"
  results.pdf_url = signedUrl ?? null

  return NextResponse.json(results)
}
