import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getR2Client, getR2Bucket } from "@/lib/r2/client"

export function buildR2Key(
  rutEmpresa: string,
  tipo: number,
  folio: number,
  fecha: Date,
  ext: "pdf" | "xml"
): string {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, "0")
  const rutClean = rutEmpresa.replace(/[.-]/g, "")
  return `dte/${rutClean}/${year}/${month}/${tipo}_${folio}.${ext}`
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<boolean> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  if (!client || !bucket) return false
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType })
    )
    return true
  } catch (err) {
    console.error("[R2] upload failed:", key, err)
    return false
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  if (!client || !bucket) return null
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    )
  } catch (err) {
    console.error("[R2] signed url failed:", key, err)
    return null
  }
}

export async function downloadFromR2(key: string): Promise<string | null> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  if (!client || !bucket) return null
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return (await res.Body?.transformToString("utf-8")) ?? null
  } catch (err) {
    console.error("[R2] download failed:", key, err)
    return null
  }
}

export function buildLogoKey(empresaId: string, ext: string): string {
  return `logos/${empresaId}.${ext}`
}

export async function resolveLogoUrl(logoUrl: string | undefined | null): Promise<string | undefined> {
  if (!logoUrl) return undefined
  if (logoUrl.startsWith("logos/")) {
    return (await getSignedDownloadUrl(logoUrl, 3600)) ?? undefined
  }
  return logoUrl
}
