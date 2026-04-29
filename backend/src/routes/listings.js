const express = require('express')
const mongoose = require('mongoose')
const Listing = require('../models/Listing.js')
const Watchlist = require('../models/Watchlist.js')
const auth = require('../middleware/auth.js')
const { optionalAuth } = require('../middleware/auth.js')

const router = express.Router()

// Sanitise + normalise the body before passing to Mongoose. Keeps the route
// handler readable and lets us reuse the same logic on POST and PUT.
function buildListingPayload(body, owner) {
  const payload = {
    title: body.title?.trim(),
    description: body.description?.trim() || '',
    listingType: body.listingType,
    propertyType: body.propertyType,
    price: body.listingType === 'sale' ? Number(body.price) || 0 : undefined,
    monthlyRent: body.listingType === 'rent' ? Number(body.monthlyRent) || 0 : undefined,
    currency: body.currency || 'MYR',
    bedrooms: Number(body.bedrooms) || 0,
    bathrooms: Number(body.bathrooms) || 0,
    parkingSpaces: Number(body.parkingSpaces) || 0,
    sqft: Number(body.sqft) || 0,
    furnished: body.furnished || 'unfurnished',
    amenities: Array.isArray(body.amenities) ? body.amenities.filter(Boolean) : [],
    images: Array.isArray(body.images) ? body.images : [],
    location: {
      address: body.location?.address?.trim() || '',
      city: body.location?.city?.trim() || '',
      state: body.location?.state?.trim() || '',
      postcode: body.location?.postcode?.trim() || '',
      country: body.location?.country?.trim() || 'Malaysia',
    },
  }

  if (owner) payload.owner = owner

  // Geo: only attach when both lng + lat are provided. Mongo's 2dsphere
  // index will reject [0,0] as a real point, so we'd rather omit.
  const lng = Number(body.location?.lng)
  const lat = Number(body.location?.lat)
  if (Number.isFinite(lng) && Number.isFinite(lat) && (lng !== 0 || lat !== 0)) {
    payload.location.geo = { type: 'Point', coordinates: [lng, lat] }
  }

  return payload
}

// GET /api/listings — public browse with filters and pagination.
//
// Query params (all optional):
//   listingType   = 'sale' | 'rent'
//   propertyType  = comma-separated list
//   minPrice / maxPrice
//   minRent / maxRent
//   bedrooms      = minimum
//   bathrooms     = minimum
//   minSqft / maxSqft
//   furnished     = 'unfurnished' | 'partially' | 'fully'
//   city          = exact match (case-insensitive)
//   state         = exact match (case-insensitive)
//   q             = free-text search
//   lat, lng, radiusKm  — radius search around point
//   sort          = 'newest' | 'price-asc' | 'price-desc'
//   page, limit
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      listingType,
      propertyType,
      minPrice,
      maxPrice,
      minRent,
      maxRent,
      bedrooms,
      bathrooms,
      minSqft,
      maxSqft,
      furnished,
      city,
      state,
      q,
      lat,
      lng,
      radiusKm,
      sort = 'newest',
    } = req.query

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = { status: 'active' }

    if (listingType === 'sale' || listingType === 'rent') {
      filter.listingType = listingType
    }
    if (propertyType) {
      const types = String(propertyType).split(',').filter(Boolean)
      if (types.length) filter.propertyType = { $in: types }
    }
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }
    if (minRent || maxRent) {
      filter.monthlyRent = {}
      if (minRent) filter.monthlyRent.$gte = Number(minRent)
      if (maxRent) filter.monthlyRent.$lte = Number(maxRent)
    }
    if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) }
    if (bathrooms) filter.bathrooms = { $gte: Number(bathrooms) }
    if (minSqft || maxSqft) {
      filter.sqft = {}
      if (minSqft) filter.sqft.$gte = Number(minSqft)
      if (maxSqft) filter.sqft.$lte = Number(maxSqft)
    }
    if (furnished) filter.furnished = furnished
    if (city) filter['location.city'] = new RegExp(`^${escapeRegExp(city)}$`, 'i')
    if (state) filter['location.state'] = new RegExp(`^${escapeRegExp(state)}$`, 'i')
    if (q) filter.$text = { $search: String(q) }

    // Radius search via $geoWithin / $centerSphere. Earth radius ≈ 6378.1 km.
    if (lat && lng && radiusKm) {
      filter['location.geo'] = {
        $geoWithin: {
          $centerSphere: [[Number(lng), Number(lat)], Number(radiusKm) / 6378.1],
        },
      }
    }

    let cursor = Listing.find(filter)
    switch (sort) {
      case 'price-asc':
        cursor = cursor.sort({ price: 1, monthlyRent: 1, createdAt: -1 })
        break
      case 'price-desc':
        cursor = cursor.sort({ price: -1, monthlyRent: -1, createdAt: -1 })
        break
      default:
        cursor = cursor.sort({ createdAt: -1 })
    }

    const [items, total] = await Promise.all([
      cursor.skip(skip).limit(limit).populate('owner', 'name kyc.status').lean(),
      Listing.countDocuments(filter),
    ])

    // Decorate each listing with `inWatchlist` for the signed-in user so the
    // browse grid can render the saved heart state without N round-trips.
    let watchedSet = new Set()
    if (req.user && items.length) {
      const watched = await Watchlist.find({
        user: req.user._id,
        listing: { $in: items.map((i) => i._id) },
      }).select('listing')
      watchedSet = new Set(watched.map((w) => String(w.listing)))
    }

    res.json({
      items: items.map((i) => ({ ...i, inWatchlist: watchedSet.has(String(i._id)) })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/listings/mine — listings the current user owns (any status).
router.get('/mine', auth, async (req, res, next) => {
  try {
    const items = await Listing.find({ owner: req.user._id }).sort({ updatedAt: -1 }).lean()
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// GET /api/listings/:id — public detail. Increments view count on a fresh GET.
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    const listing = await Listing.findById(req.params.id).populate('owner', 'name kyc.status createdAt')
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    // Hide non-active listings from anyone who isn't the owner or an admin.
    const isOwner = req.user && String(listing.owner._id) === String(req.user._id)
    const isAdmin = req.user && req.user.role === 'admin'
    if (listing.status !== 'active' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    if (!isOwner) {
      // Fire-and-forget — don't block the response on the view bump.
      Listing.updateOne({ _id: listing._id }, { $inc: { views: 1 } }).catch(() => {})
    }

    let inWatchlist = false
    if (req.user) {
      inWatchlist = !!(await Watchlist.exists({ user: req.user._id, listing: listing._id }))
    }

    res.json({ listing, inWatchlist })
  } catch (err) {
    next(err)
  }
})

// POST /api/listings — owner creates a draft. Goes straight to `pending`
// when ownership documents are attached, otherwise stays `draft` for them
// to come back to.
router.post('/', auth, async (req, res, next) => {
  try {
    const payload = buildListingPayload(req.body, req.user._id)

    if (!payload.title || !payload.listingType || !payload.propertyType) {
      return res.status(400).json({ error: 'Title, listing type, and property type are required' })
    }
    if (payload.listingType === 'sale' && !payload.price) {
      return res.status(400).json({ error: 'Sale listings need a price' })
    }
    if (payload.listingType === 'rent' && !payload.monthlyRent) {
      return res.status(400).json({ error: 'Rental listings need a monthly rent' })
    }

    if (Array.isArray(req.body.ownershipDocuments) && req.body.ownershipDocuments.length) {
      payload.verification = {
        verified: false,
        documents: req.body.ownershipDocuments,
      }
      payload.status = 'pending'
    } else {
      payload.status = 'draft'
    }

    const listing = await Listing.create(payload)
    res.status(201).json({ listing })
  } catch (err) {
    next(err)
  }
})

// PUT /api/listings/:id — owner updates their listing. If they touch any
// non-cosmetic field while in `active` we kick it back to `pending` for
// admin re-review. Image and description tweaks alone don't trigger review.
router.put('/:id', auth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id)
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    const isOwner = String(listing.owner) === String(req.user._id)
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed to edit this listing' })
    }

    const update = buildListingPayload(req.body)
    Object.assign(listing, update)

    if (Array.isArray(req.body.ownershipDocuments)) {
      listing.verification = {
        ...listing.verification?.toObject?.(),
        documents: req.body.ownershipDocuments,
      }
    }

    // Owners can publish from draft once they've added images + docs.
    if (req.body.publish && listing.status === 'draft') {
      listing.status = 'pending'
    }

    await listing.save()
    res.json({ listing })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/listings/:id — owner archives their own listing. Hard-delete
// is restricted to admins so we keep the audit trail intact.
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id)
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    const isOwner = String(listing.owner) === String(req.user._id)
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }

    if (req.user.role === 'admin' && req.query.hard === 'true') {
      await listing.deleteOne()
      return res.json({ message: 'Listing deleted' })
    }

    listing.status = 'archived'
    await listing.save()
    res.json({ message: 'Listing archived', listing })
  } catch (err) {
    next(err)
  }
})

// POST /api/listings/:id/mark — owner toggles status to 'sold' or 'rented'.
router.post('/:id/mark', auth, async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['sold', 'rented', 'active'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const listing = await Listing.findById(req.params.id)
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (String(listing.owner) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }

    listing.status = status
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
