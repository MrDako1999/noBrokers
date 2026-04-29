const express = require('express')
const Offer = require('../models/Offer.js')
const Listing = require('../models/Listing.js')
const auth = require('../middleware/auth.js')

const router = express.Router()

// POST /api/offers — buyer creates an offer on a listing.
router.post('/', auth, async (req, res, next) => {
  try {
    const { listingId, amount, message } = req.body
    if (!listingId || !amount) {
      return res.status(400).json({ error: 'Listing and amount are required' })
    }

    const listing = await Listing.findById(listingId)
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is not accepting offers' })
    }
    if (String(listing.owner) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't make an offer on your own listing" })
    }

    const type = listing.listingType === 'sale' ? 'purchase' : 'rent'
    const askingPrice = listing.listingType === 'sale' ? listing.price : listing.monthlyRent

    const offer = await Offer.create({
      listing: listing._id,
      buyer: req.user._id,
      owner: listing.owner,
      type,
      listingAskingPrice: askingPrice || 0,
      currentAmount: Number(amount),
      negotiations: [
        {
          from: req.user._id,
          actorRole: 'buyer',
          amount: Number(amount),
          message: message?.trim() || '',
        },
      ],
      lastActivityAt: new Date(),
    })

    res.status(201).json({ offer })
  } catch (err) {
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
    const { action, amount, message } = req.body
    const offer = await Offer.findById(req.params.id)
    if (!offer) return res.status(404).json({ error: 'Offer not found' })

    const isBuyer = String(offer.buyer) === String(req.user._id)
    const isOwner = String(offer.owner) === String(req.user._id)
    if (!isBuyer && !isOwner) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    if (['accepted', 'rejected', 'withdrawn'].includes(offer.status)) {
      return res.status(400).json({ error: 'This offer is already closed' })
    }

    const actorRole = isBuyer ? 'buyer' : 'owner'

    switch (action) {
      case 'counter': {
        if (!amount || Number(amount) <= 0) {
          return res.status(400).json({ error: 'Counter amount is required' })
        }
        offer.negotiations.push({
          from: req.user._id,
          actorRole,
          amount: Number(amount),
          message: message?.trim() || '',
        })
        offer.currentAmount = Number(amount)
        offer.status = 'countered'
        break
      }
      case 'accept': {
        // Only the *other* party can accept the latest amount.
        const last = offer.negotiations[offer.negotiations.length - 1]
        if (last && last.actorRole === actorRole) {
          return res
            .status(400)
            .json({ error: 'You can only accept an offer the other party made' })
        }
        offer.status = 'accepted'
        offer.negotiations.push({
          from: req.user._id,
          actorRole,
          amount: offer.currentAmount,
          message: message?.trim() || 'Accepted',
        })
        break
      }
      case 'reject': {
        offer.status = 'rejected'
        offer.negotiations.push({
          from: req.user._id,
          actorRole,
          amount: offer.currentAmount,
          message: message?.trim() || 'Rejected',
        })
        break
      }
      case 'withdraw': {
        if (!isBuyer) {
          return res.status(400).json({ error: 'Only the buyer can withdraw an offer' })
        }
        offer.status = 'withdrawn'
        offer.negotiations.push({
          from: req.user._id,
          actorRole,
          amount: offer.currentAmount,
          message: message?.trim() || 'Withdrawn',
        })
        break
      }
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }

    offer.lastActivityAt = new Date()
    await offer.save()
    res.json({ offer })
  } catch (err) {
    next(err)
  }
})

module.exports = router
