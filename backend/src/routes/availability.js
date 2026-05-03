const express = require('express')
const mongoose = require('mongoose')
const AvailabilityRule = require('../models/AvailabilityRule.js')
const AvailabilityException = require('../models/AvailabilityException.js')
const Listing = require('../models/Listing.js')
const Viewing = require('../models/Viewing.js')
const auth = require('../middleware/auth.js')
const requireSeller = require('../middleware/requireSeller.js')
const availability = require('../services/availability.js')

const router = express.Router()

// Read the caller's availability (rules + exceptions). Seller-gated; the
// public slot endpoint below is what buyers talk to.
router.get('/owners/me/availability', auth, requireSeller, async (req, res, next) => {
  try {
    const [rules, exceptions] = await Promise.all([
      AvailabilityRule.find({ owner: req.user._id }).sort({ weekday: 1, startMinute: 1 }).lean(),
      AvailabilityException.find({ owner: req.user._id })
        .where('endAt').gte(new Date())
        .sort({ startAt: 1 })
        .lean(),
    ])
    res.json({
      rules,
      exceptions,
      defaults: {
        timezone: req.user.preferences?.timezone || 'Asia/Kuala_Lumpur',
      },
    })
  } catch (err) {
    next(err)
  }
})

// Bulk replace the caller's rules. Simpler than per-row CRUD for v1: the
// UI sends the entire weekly schedule; we wipe + re-insert. Exception
// editing stays per-row (below) because they're one-offs.
//
// Body: { rules: [{ weekday, startMinute, endMinute, slotLengthMin, timezone }], timezone? }
router.put('/owners/me/availability', auth, requireSeller, async (req, res, next) => {
  try {
    const { rules, timezone } = req.body
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules must be an array' })
    }

    const tz = timezone || req.user.preferences?.timezone || 'Asia/Kuala_Lumpur'

    const sanitized = []
    for (const r of rules) {
      const weekday = Number(r.weekday)
      const startMinute = Number(r.startMinute)
      const endMinute = Number(r.endMinute)
      if (![0, 1, 2, 3, 4, 5, 6].includes(weekday)) {
        return res.status(400).json({ error: 'Invalid weekday' })
      }
      if (
        !Number.isFinite(startMinute) ||
        !Number.isFinite(endMinute) ||
        startMinute < 0 ||
        endMinute > 1440 ||
        endMinute - startMinute < 15
      ) {
        return res.status(400).json({ error: 'Invalid time window (must be at least 15m)' })
      }
      sanitized.push({
        owner: req.user._id,
        scope: { kind: 'all', listing: null },
        weekday,
        startMinute,
        endMinute,
        slotLengthMin: Math.max(5, Math.min(480, Number(r.slotLengthMin) || 30)),
        bufferMin: 0,
        timezone: r.timezone || tz,
        active: true,
      })
    }

    // Wipe + insert in a single ordered pass. Mongoose supports transactions
    // but our Mongo URI may not (free-tier standalone), so we accept a small
    // window of inconsistency here and rely on the session-less pattern.
    await AvailabilityRule.deleteMany({ owner: req.user._id, 'scope.kind': 'all' })
    if (sanitized.length) await AvailabilityRule.insertMany(sanitized)

    // Persist the default timezone on the user as well so the slot endpoint
    // has a sensible fallback if rules get wiped.
    if (timezone) {
      req.user.preferences = {
        ...(req.user.preferences?.toObject?.() || req.user.preferences || {}),
        timezone,
      }
      await req.user.save()
    }

    const rulesOut = await AvailabilityRule.find({ owner: req.user._id })
      .sort({ weekday: 1, startMinute: 1 })
      .lean()
    res.json({ rules: rulesOut })
  } catch (err) {
    next(err)
  }
})

// POST exception. Body: { startAt, endAt, kind: 'block'|'open', reason? }
router.post('/owners/me/availability/exceptions', auth, requireSeller, async (req, res, next) => {
  try {
    const { startAt, endAt, kind, reason } = req.body
    const s = new Date(startAt)
    const e = new Date(endAt)
    if (isNaN(s) || isNaN(e) || e <= s) {
      return res.status(400).json({ error: 'Invalid date range' })
    }
    if (kind !== 'block' && kind !== 'open') {
      return res.status(400).json({ error: 'kind must be "block" or "open"' })
    }
    const doc = await AvailabilityException.create({
      owner: req.user._id,
      scope: { kind: 'all', listing: null },
      startAt: s,
      endAt: e,
      kind,
      reason: typeof reason === 'string' ? reason.slice(0, 200) : '',
    })
    res.status(201).json({ exception: doc })
  } catch (err) {
    next(err)
  }
})

router.delete('/owners/me/availability/exceptions/:id', auth, requireSeller, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Exception not found' })
    }
    const doc = await AvailabilityException.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    })
    if (!doc) return res.status(404).json({ error: 'Exception not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    next(err)
  }
})

// GET /api/listings/:id/slots?from=ISO&to=ISO&tz=IANA
// Public: a buyer doesn't need to be signed in to see what windows are
// bookable. Capped to a 30-day window to keep the expansion cheap.
router.get('/listings/:id/slots', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Listing not found' })
    }
    const listing = await Listing.findById(req.params.id).select('owner status')
    if (!listing || listing.status !== 'active') {
      return res.status(404).json({ error: 'Listing not found' })
    }

    const now = new Date()
    const from = req.query.from ? new Date(req.query.from) : now
    let to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 14 * 86400000)
    if (isNaN(from) || isNaN(to) || to <= from) {
      return res.status(400).json({ error: 'Invalid date range' })
    }
    const maxMs = 30 * 86400000
    if (to - from > maxMs) to = new Date(from.getTime() + maxMs)
    // Never expose slots in the past.
    const effectiveFrom = from < now ? now : from

    const [rules, exceptions, busy] = await Promise.all([
      AvailabilityRule.find({
        owner: listing.owner,
        $or: [
          { 'scope.kind': 'all' },
          { 'scope.kind': 'listing', 'scope.listing': listing._id },
        ],
        active: true,
      }).lean(),
      AvailabilityException.find({
        owner: listing.owner,
        startAt: { $lt: to },
        endAt: { $gt: effectiveFrom },
        $or: [
          { 'scope.kind': 'all' },
          { 'scope.kind': 'listing', 'scope.listing': listing._id },
        ],
      }).lean(),
      Viewing.find({
        owner: listing.owner,
        startAt: { $lt: to },
        endAt: { $gt: effectiveFrom },
        status: { $in: ['requested', 'counter_proposed', 'accepted'] },
      }).select('startAt endAt status listing').lean(),
    ])

    const expanded = availability.expandRules(rules, effectiveFrom, to)
    const afterExceptions = availability.applyExceptions(expanded, exceptions, {
      slotLengthMin: rules[0]?.slotLengthMin || 30,
    })
    const free = availability.subtractViewings(afterExceptions, busy)

    res.json({
      slots: free.map((s) => ({
        startAt: s.startAt,
        endAt: s.endAt,
      })),
      timezone: rules[0]?.timezone || 'Asia/Kuala_Lumpur',
      window: { from: effectiveFrom, to },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
