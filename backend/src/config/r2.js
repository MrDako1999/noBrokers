const { S3Client } = require('@aws-sdk/client-s3')

// Cloudflare R2 is S3-compatible. The endpoint is per-account:
// https://<accountId>.r2.cloudflarestorage.com. Region must be 'auto'.
let cachedClient = null

function getR2Client() {
  if (cachedClient) return cachedClient

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 is not configured (missing R2_* env vars)')
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })

  return cachedClient
}

function getBucket() {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET is not set')
  return bucket
}

function getPublicBaseUrl() {
  const url = process.env.R2_PUBLIC_BASE_URL
  if (!url) throw new Error('R2_PUBLIC_BASE_URL is not set')
  return url.replace(/\/+$/, '')
}

function publicUrlFor(key) {
  return `${getPublicBaseUrl()}/${key}`
}

module.exports = { getR2Client, getBucket, getPublicBaseUrl, publicUrlFor }
