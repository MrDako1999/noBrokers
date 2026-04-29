const mongoose = require('mongoose')

// A separate collection (not embedded on User) so we can paginate, sort by
// addedAt, and store per-watch metadata (notes, alerts) later without
// rewriting the user document on every change.
const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

// One entry per (user, listing) pair.
watchlistSchema.index({ user: 1, listing: 1 }, { unique: true })

module.exports = mongoose.model('Watchlist', watchlistSchema)
