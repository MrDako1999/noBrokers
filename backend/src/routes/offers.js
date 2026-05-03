const express = require('express')
const Offer = require('../models/Offer.js')
const auth = require('../middleware/auth.js')
const offerService = require('../services/offers.js')

const router = express.Router()

function fromServiceError(err, res) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message })
  }
  return null
}

// POST /api/offers — buyer creates an offer on a listing.
router.post('/', auth, async (req, res, next) => {
  try {
    const offer = await offerService.createOffer({
      listingId: req.body.listingId,
      buyerId: req.user._id,
      amount: req.body.amount,
      message: req.body.message,
    })
    res.status(201).json({ offer })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

// GET /api/offers/sent — offers I (the buyer) have made.
router.get('/sent', auth, async (req, res, next) => {
  try {
    const items = await Offer.find({ buyer: req.user._id })
      .sort({ lastActivityAt: -1 })
      .populate('listing', 'title images listingType price monthlyRent location status')
      .populate('owner', 'name')
      .lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// GET /api/offers/received — offers on listings I own.
router.get('/received', auth, async (req, res, next) => {
  try {
    const items = await Offer.find({ owner: req.user._id })
      .sort({ lastActivityAt: -1 })
      .populate('listing', 'title images listingType price monthlyRent location status')
      .populate('buyer', 'name kyc.status')
      .lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// GET /api/offers/:id — full offer with negotiation thread. Only the buyer
// or owner can see the conversation.
router.get('/:id', auth, async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('listing', 'title images listingType price monthlyRent location status owner')
      .populate('buyer', 'name kyc.status')
      .populate('owner', 'name')
      .populate('negotiations.from', 'name')

    if (!offer) return res.status(404).json({ error: 'Offer not found' })
    const isParty = [String(offer.buyer._id), String(offer.owner._id)].includes(String(req.user._id))
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }
    res.json({ offer })
  } catch (err) {
    next(err)
  }
})

// POST /api/offers/:id/respond — owner or buyer adds a counter, accepts,
// rejects, or withdraws.
//
// Body: { action: 'counter'|'accept'|'reject'|'withdraw', amount?, message? }
router.post('/:id/respond', auth, async (req, res, next) => {
  try {
    const offer = await offerService.respondToOffer({
      offerId: req.params.id,
      userId: req.user._id,
      action: req.body.action,
      amount: req.body.amount,
      message: req.body.message,
    })
    res.json({ offer })
  } catch (err) {
    if (fromServiceError(err, res)) return
    next(err)
  }
})

module.exports = router
