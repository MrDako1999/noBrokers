const mongoose = require('mongoose')

// One entry in the back-and-forth thread on an offer. We store the actor
// instead of inferring from buyer/owner so the UI can render "you" / "owner"
// labels without an extra lookup.
const negotiationSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: ['buyer', 'owner'], required: true },
    amount: { type: Number, min: 0, required: true },
    message: { type: String, default: '', maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const offerSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Mirrors Listing.listingType — `purchase` for sale listings,
    // `rent` for rental listings (offer is monthly rent).
    type: { type: String, enum: ['purchase', 'rent'], required: true },

    // Snapshot of the listing's asking price at the time the offer was made.
    // Lets us show "10% below asking" even if the listing price changes later.
    listingAskingPrice: { type: Number, min: 0, required: true },

    // Latest (current) proposed amount. Always equals the last entry in
    // `negotiations`. Denormalised to make sorting / filtering trivial.
    currentAmount: { type: Number, min: 0, required: true },

    status: {
      type: String,
      enum: ['pending', 'countered', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },

    negotiations: { type: [negotiationSchema], default: [] },

    // Denormalised so we can sort offer lists by activity without joining.
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

offerSchema.index({ listing: 1, buyer: 1 })
offerSchema.index({ owner: 1, status: 1, lastActivityAt: -1 })
offerSchema.index({ buyer: 1, status: 1, lastActivityAt: -1 })

module.exports = mongoose.model('Offer', offerSchema)
