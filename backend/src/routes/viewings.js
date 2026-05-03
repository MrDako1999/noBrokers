const express = require('express')
const mongoose = require('mongoose')
const Viewing = require('../models/Viewing.js')
const Listing = require('../models/Listing.js')
const auth = require('../middleware/auth.js')
const viewingsService = require('../services/viewings.js')

const router = express.Router()

// Shape error thrown from the service (status + message) into a JSON reply.
function fromServiceError(err, res) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message })
  }
  return null
}

// GET /api/viewings/mine?side=owner|buyer&status=requested,accepted
// Unified inbox. `side` defaults to both; buyers/owners can narrow. Sorted
// by last activity so the inbox acts like an inbox.
router.get('/mine', auth, async (req, res, next) => {
  try {
    const { side, status, upcoming } = req.query
    const filter = {}
    if (side === 'owner') filter.owner = req.user._id
    else if (side === 'buyer') filter.buyer = req.user._id
    else filter.$or = [{ owner: req.user._id }, { buyer: req.user._id }]

    if (status) {
      const list = String(status).split(',').filter(Boolean)
      if (list.length) filter.status = { $in: list }
    }
    if (upcoming === 'true') {
      filter.startAt = { $gte: new Date() }
    }

    const items = await Viewing.find(filter)
      .sort({ lastActivityAt: -1 })
      .populate('listing', 'title images listingType price monthlyRent location status')
      .populate('buyer', 'name kyc.status')
      .populate('owner', 'name')
      .lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// GET /api/viewings/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Viewing not found' })
    }
    const viewing = await Viewing.findById(req.params.id)
      .populate('listing', 'title images listingType price monthlyRent location status owner')
      .populate('buyer', 'name kyc.status email phone')
      .populate('owner', 'name email phone')
      .populate('proposals.by', 'name')

    if (!viewing) return res.status(404).json({ error: 'Viewing not found' })
    const party = [String(viewing.buyer._id), String(viewing.owner._id)].includes(
      String(req.user._id),
    )
    if (!party && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }
    res.json({ viewing })
  } catch (err) {
    next(err)
  }
})

// POST /api/viewings — buyer creates a new request.
// Body: { listingId, startAt, endAt, mode, notes, timezone }
router.post('/', auth, async (req, res, next) => {
  try {
    const { listingId, startAt, endAt, mode, notes, timezone } = req.body
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ error: 'listingId is required' })
    }
    const s = new Date(startAt)
    const e = new Date(endAt)
    if (isNaN(s) || isNaN(e) || e <= s) {
      return res.status(400).json({ error: 'Invalid time window' })
    }
    const listing = await Listing.findById(listingId).select('owner status')
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    const viewing = await viewingsService.createRequest({
      listing,
      buyerId: req.user._id,
      startAt: s,
      endAt: e,
      mode,
      notes,
      timezone,
    })
    res.status(201).json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/accept', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.acceptRequest(req.params.id, req.user._id)
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/decline', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.decline(req.params.id, req.user._id, req.body.reason)
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/cancel', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.cancel(req.params.id, req.user._id, req.body.reason)
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/propose', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.propose(req.params.id, req.user._id, req.body)
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/accept-proposal/:pid', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.acceptProposal(
      req.params.id,
      req.params.pid,
      req.user._id,
    )
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/complete', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.markOutcome(req.params.id, req.user._id, 'completed')
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

router.post('/:id/no-show', auth, async (req, res, next) => {
  try {
    const viewing = await viewingsService.markOutcome(req.params.id, req.user._id, 'no_show')
    res.json({ viewing })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

// GET /api/viewings/:id/ics — returns an .ics calendar file for the viewing.
// Only parties (or admin) can pull it. Fetched via axios (with the JWT
// header) and surfaced as a blob download on the client.
router.get('/:id/ics', auth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Viewing not found' })
    }
    const viewing = await Viewing.findById(req.params.id)
      .populate('listing', 'title location')
      .populate('owner', 'name email')
      .populate('buyer', 'name email')
    if (!viewing) return res.status(404).json({ error: 'Viewing not found' })
    const party = [String(viewing.buyer._id), String(viewing.owner._id)].includes(
      String(req.user._id),
    )
    if (!party && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }
    if (viewing.status !== 'accepted') {
      return res.status(400).json({ error: 'Viewing must be accepted to export' })
    }

    const ics = buildIcs(viewing)
    res
      .setHeader('Content-Type', 'text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="viewing-${viewing._id}.ics"`)
      .send(ics)
  } catch (err) {
    next(err)
  }
})

// --- ICS builder ------------------------------------------------------------
// Minimal RFC 5545 generator — just enough for Apple/Google/Outlook to
// ingest. Line endings must be CRLF per spec. We keep it as a single
// function inline because it's the only consumer and doesn't warrant a
// dedicated service file.
function icsDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  const dt = new Date(d)
  return (
    dt.getUTCFullYear() +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate()) +
    'T' +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    pad(dt.getUTCSeconds()) +
    'Z'
  )
}

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function buildIcs(viewing) {
  const addr = [
    viewing.listing?.location?.address,
    viewing.listing?.location?.city,
    viewing.listing?.location?.state,
    viewing.listing?.location?.postcode,
  ]
    .filter(Boolean)
    .join(', ')
  const description = [
    `noBrokers.my viewing request.`,
    `Owner: ${viewing.owner?.name || ''}`,
    `Buyer: ${viewing.buyer?.name || ''}`,
    viewing.notes ? `Notes: ${viewing.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//noBrokers//Viewings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:viewing-${viewing._id}@nobrokers.my`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(viewing.startAt)}`,
    `DTEND:${icsDate(viewing.endAt)}`,
    `SUMMARY:${icsEscape(
      `Viewing: ${viewing.listing?.title || 'Property'}`,
    )}`,
    `DESCRIPTION:${icsEscape(description)}`,
    addr ? `LOCATION:${icsEscape(addr)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n')
}

module.exports = router
