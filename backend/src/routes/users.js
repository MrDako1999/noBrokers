const express = require('express')
const User = require('../models/User.js')
const auth = require('../middleware/auth.js')

const router = express.Router()

// POST /api/users/kyc — submit KYC documents for verification.
// Accepts an array of { type, url, key } produced by the upload presign flow.
router.post('/kyc', auth, async (req, res, next) => {
  try {
    const { documents } = req.body
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'At least one document is required' })
    }

    for (const doc of documents) {
      if (!doc?.type || !doc?.url || !doc?.key) {
        return res.status(400).json({ error: 'Each document needs type, url, and key' })
      }
    }

    const user = await User.findById(req.user._id)

    // Append (don't replace) so a user can add more docs after a partial
    // submission. Admin reviews the whole stack on the verify panel.
    user.kyc.documents = [...(user.kyc.documents || []), ...documents]
    user.kyc.status = 'pending'
    user.kyc.submittedAt = new Date()
    user.kyc.rejectionReason = undefined
    await user.save()

    res.json({ user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/kyc/status — quick polling endpoint for the dashboard.
router.get('/kyc/status', auth, async (req, res) => {
  res.json({
    status: req.user.kyc?.status || 'unverified',
    submittedAt: req.user.kyc?.submittedAt || null,
    verifiedAt: req.user.kyc?.verifiedAt || null,
    rejectionReason: req.user.kyc?.rejectionReason || null,
    documents: req.user.kyc?.documents || [],
  })
})

// GET /api/users/:id/public — sanitised owner card (name, kyc verified flag).
// Used on the listing detail page so buyers can see "verified owner" without
// us leaking emails/phones until an offer creates a real connection.
router.get('/:id/public', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name kyc.status createdAt')
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({
      _id: user._id,
      name: user.name,
      verified: user.kyc?.status === 'verified',
      memberSince: user.createdAt,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
