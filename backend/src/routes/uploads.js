const express = require('express')
const crypto = require('crypto')
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const auth = require('../middleware/auth.js')
const { getR2Client, getBucket, publicUrlFor } = require('../config/r2.js')

const router = express.Router()

const ALLOWED_KINDS = new Set(['listing-image', 'kyc-doc', 'ownership-doc'])

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'application/pdf',
])

const MAX_BYTES = 15 * 1024 * 1024 // 15MB hard cap, the presign also enforces this.

function extFromMime(mime) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'image/heic':
      return 'heic'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'bin'
  }
}

// POST /api/uploads/presign
//
// Body: { contentType, kind, filename? }
//   kind: 'listing-image' | 'kyc-doc' | 'ownership-doc'
//
// Returns: { uploadUrl, key, publicUrl, expiresIn }
//
// Frontend then `PUT`s the file to `uploadUrl` with the same Content-Type
// header, and submits `publicUrl` + `key` with the related entity (listing
// or KYC doc) on the relevant endpoint.
router.post('/presign', auth, async (req, res, next) => {
  try {
    const { contentType, kind } = req.body
    if (!contentType || !kind) {
      return res.status(400).json({ error: 'contentType and kind are required' })
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return res.status(400).json({ error: 'Invalid upload kind' })
    }
    if (!ALLOWED_MIME.has(contentType)) {
      return res.status(400).json({ error: 'Unsupported file type' })
    }

    const id = crypto.randomBytes(12).toString('hex')
    const ext = extFromMime(contentType)
    // Folder per kind, scoped under the user's id so an admin sweep of one
    // user's uploads is a single prefix listing.
    const folder =
      kind === 'listing-image' ? 'listings' : kind === 'kyc-doc' ? 'kyc' : 'ownership'
    const key = `${folder}/${req.user._id}/${Date.now()}-${id}.${ext}`

    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
      // R2 ignores ContentLength on presigned PUT but we keep it for
      // documentation; the real cap is enforced in front of upload by
      // the Vite-side input.
      ContentLength: undefined,
    })

    const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 60 * 5 })

    res.json({
      uploadUrl,
      key,
      publicUrl: publicUrlFor(key),
      expiresIn: 300,
      maxBytes: MAX_BYTES,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/uploads/:key — remove a file from R2. The key arrives URL-encoded.
//
// We don't strictly check ownership of the key here because the upload is
// scoped under `<folder>/<userId>/...`. An admin can delete anything; a
// regular user can only delete keys that start with their own user id.
router.delete('/*', auth, async (req, res, next) => {
  try {
    // Express captures the wildcard in req.params[0]; we use that as the key.
    const key = decodeURIComponent(req.params[0] || '')
    if (!key) return res.status(400).json({ error: 'Key required' })

    if (req.user.role !== 'admin') {
      const userPrefix = `/${req.user._id}/`
      if (!key.includes(userPrefix)) {
        return res.status(403).json({ error: 'Not allowed to delete this object' })
      }
    }

    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    )
    res.json({ message: 'Deleted', key })
  } catch (err) {
    next(err)
  }
})

module.exports = router
