const express = require('express')
const Watchlist = require('../models/Watchlist.js')
const Listing = require('../models/Listing.js')
const auth = require('../middleware/auth.js')

const router = express.Router()

// GET /api/watchlist — listings the current user has saved.
router.get('/', auth, async (req, res, next) => {
  try {
    const items = await Watchlist.find({ user: req.user._id })
      .sort({ addedAt: -1 })
      .populate({
        path: 'listing',
        select: 'title images listingType price monthlyRent location status bedrooms bathrooms sqft',
      })
      .lean()

    // Drop entries where the listing was deleted out from under us.
    const filtered = items.filter((i) => i.listing)
    res.json({ items: filtered })
  } catch (err) {
    next(err)
  }
})

// POST /api/watchlist/:listingId — add to watchlist (idempotent).
router.post('/:listingId', auth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.listingId).select('_id')
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    await Watchlist.updateOne(
      { user: req.user._id, listing: listing._id },
      { $setOnInsert: { addedAt: new Date() } },
      { upsert: true },
    )
    res.json({ inWatchlist: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/watchlist/:listingId — remove from watchlist.
router.delete('/:listingId', auth, async (req, res, next) => {
  try {
    await Watchlist.deleteOne({ user: req.user._id, listing: req.params.listingId })
    res.json({ inWatchlist: false })
  } catch (err) {
    next(err)
  }
})

module.exports = router
