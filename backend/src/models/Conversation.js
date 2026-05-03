const mongoose = require('mongoose')

// One conversation per (listing, buyer). The owner is denormalised from
// `listing.owner` on creation so inbox queries can group/filter without
// joining. If a listing changes owner (rare) we'd want a backfill, but the
// common path stays a single Mongo round-trip.
const conversationSchema = new mongoose.Schema(
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

    // Latest activity for inbox sort + 1-line preview rendering.
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '', maxlength: 200 },

    // Per-side unread counter. Bumped on incoming message to the *other*
    // party, zeroed when that party calls `POST /:id/read`.
    unread: {
      buyer: { type: Number, default: 0 },
      owner: { type: Number, default: 0 },
    },

    // Optional pointers that let the chat surface deep-link cards into the
    // existing offer / viewing pages. Set the first time an offer or
    // viewing is created on this listing by this buyer.
    linkedOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      default: null,
    },
    linkedViewingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Viewing',
      default: null,
    },
  },
  { timestamps: true },
)

// One conversation per buyer per listing.
conversationSchema.index({ listing: 1, buyer: 1 }, { unique: true })

// Inbox queries.
conversationSchema.index({ owner: 1, lastMessageAt: -1 })
conversationSchema.index({ buyer: 1, lastMessageAt: -1 })

module.exports = mongoose.model('Conversation', conversationSchema)
