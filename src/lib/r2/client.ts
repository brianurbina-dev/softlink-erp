import { S3Client } from "@aws-sdk/client-s3"

let _client: S3Client | null = null

export function getR2Client(): S3Client | null {
  if (_client) return _client
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  return _client
}

export function getR2Bucket(): string {
  return process.env.R2_BUCKET_NAME ?? ""
}
