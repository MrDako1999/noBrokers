const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
    width: Number,
    height: Number,
  },
  { _id: false },
)

const ownershipDocSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['title_deed', 'spa', 'utility_bill', 'quit_rent', 'strata', 'other'],
      required: true,
    },
    url: { type: String, required: true },
    key: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 4000 },

    // Listing intent — for sale or for rent. Drives which fields are surfaced
    // to the buyer/tenant on the detail page (price vs monthlyRent, etc).
    listingType: {
      type: String,
      enum: ['sale', 'rent'],
      required: true,
      index: true,
    },

    propertyType: {
      type: String,
      enum: [
        'condo',
        'apartment',
        'serviced_residence',
        'terrace',
        'semi_detached',
        'bungalow',
        'townhouse',
        'land',
        'commercial',
        'shop_office',
      ],
      required: true,
      index: true,
    },

    // Sale uses `price`; rent uses `monthlyRent`. We keep both fields on the
    // schema so a single browse query can sort/filter on whichever one is
    // relevant without branching the model.
    price: { type: Number, min: 0 },
    monthlyRent: { type: Number, min: 0 },
    currency: { type: String, default: 'MYR' },

    bedrooms: { type: Number, min: 0, default: 0 },
    bathrooms: { type: Number, min: 0, default: 0 },
    parkingSpaces: { type: Number, min: 0, default: 0 },
    sqft: { type: Number, min: 0, default: 0 },
    furnished: {
      type: String,
      enum: ['unfurnished', 'partially', 'fully'],
      default: 'unfurnished',
    },

    amenities: { type: [String], default: [] },

    location: {
      address: { type: String, default: '' },
      city: { type: String, default: '', index: true },
      state: { type: String, default: '', index: true },
      postcode: { type: String, default: '' },
      country: { type: String, default: 'Malaysia' },
      // GeoJSON Point — [longitude, latitude]. Indexed with 2dsphere so we
      // can use $geoWithin / $nearSphere for radius search on browse.
      geo: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
      },
    },

    images: { type: [imageSchema], default: [] },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Listing lifecycle. `pending` = awaiting admin verification of
    // ownership docs. Only `active` listings show up in the public browse.
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'rejected', 'sold', 'rented', 'archived'],
      default: 'draft',
      index: true,
    },

    verification: {
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectionReason: String,
      documents: { type: [ownershipDocSchema], default: [] },
    },

    views: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// 2dsphere geo index — required for $geoNear / $geoWithin / $nearSphere.
listingSchema.index({ 'location.geo': '2dsphere' })

// Text index for free-text search across title, description, and city.
// Mongo's text search is good enough for the MVP; we can move to Atlas
// Search later for typo tolerance and faceting.
listingSchema.index({ title: 'text', description: 'text', 'location.city': 'text' })

// Common compound index for the default browse sort.
listingSchema.index({ status: 1, listingType: 1, createdAt: -1 })

module.exports = mongoose.model('Listing', listingSchema)
