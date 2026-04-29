const express = require('express')
const User = require('../models/User.js')
const Listing = require('../models/Listing.js')
const auth = require('../middleware/auth.js')
const admin = require('../middleware/admin.js')

const router = express.Router()

router.use(auth, admin)

// GET /api/admin/stats — top-level counts for the admin dashboard.
router.get('/stats', async (req, res, next) => {
  try {
    const [users, pendingKyc, pendingListings, activeListings, totalListings] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'kyc.status': 'pending' }),
      Listing.countDocuments({ status: 'pending' }),
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments(),
    ])
    res.json({ users, pendingKyc, pendingListings, activeListings, totalListings })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/users — list users with filters.
//   query: status=unverified|pending|verified|rejected, search=email/name
router.get('/users', async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.status) filter['kyc.status'] = req.query.status
    if (req.query.search) {
      const re = new RegExp(escapeRegExp(req.query.search), 'i')
      filter.$or = [{ email: re }, { name: re }]
    }
    const items = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/kyc — approve or reject a user's KYC submission.
//   body: { action: 'approve'|'reject', reason? }
router.post('/users/:id/kyc', async (req, res, next) => {
  try {
    const { action, reason } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (action === 'approve') {
      user.kyc.status = 'verified'
      user.kyc.verifiedAt = new Date()
      user.kyc.verifiedBy = req.user._id
      user.kyc.rejectionReason = undefined
    } else if (action === 'reject') {
      user.kyc.status = 'rejected'
      user.kyc.rejectionReason = reason?.trim() || 'Documents could not be verified'
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

    await user.save()
    res.json({ user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/role — promote/demote.
router.post('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/listings — list listings filtered by status.
router.get('/listings', async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const items = await Listing.find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate('owner', 'name email kyc.status')
      .lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/listings/:id/verify — approve or reject ownership docs.
//   body: { action: 'approve'|'reject', reason? }
router.post('/listings/:id/verify', async (req, res, next) => {
  try {
    const { action, reason } = req.body
    const listing = await Listing.findById(req.params.id)
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    if (action === 'approve') {
      listing.status = 'active'
      listing.verification.verified = true
      listing.verification.verifiedAt = new Date()
      listing.verification.verifiedBy = req.user._id
      listing.verification.rejectionReason = undefined
    } else if (action === 'reject') {
      listing.status = 'rejected'
      listing.verification.verified = false
      listing.verification.rejectionReason =
        reason?.trim() || 'Ownership documents could not be verified'
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

    await listing.save()
    res.json({ listing })
  } catch (err) {
    next(err)
  }
})

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
