const mongoose = require('mongoose')

// A single weekly recurrence that tells us when an owner is open to viewings.
// Think Calendly's weekly schedule — one row per (weekday, time window).
//
// `scope` lets us grow into per-listing overrides without a migration. For
// v1 we only write `{ kind: 'all' }` rows (global owner availability); the
// slot engine already checks both `all` and `listing` rows when resolving
// a specific listing's availability.
const availabilityRuleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scope: {
      kind: { type: String, enum: ['all', 'listing'], default: 'all' },
      listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    },
    // 0 = Sunday … 6 = Saturday, matching `Date#getDay()`.
    weekday: { type: Number, min: 0, max: 6, required: true },
    // Minutes-since-midnight in the owner's `timezone`. Half-open: slots run
    // [startMinute, endMinute). Validated so we never persist overnight spans.
    startMinute: { type: Number, min: 0, max: 1440, required: true },
    endMinute: { type: Number, min: 0, max: 1440, required: true },

    slotLengthMin: { type: Number, min: 5, max: 480, default: 30 },
    // Extra gap padded between accepted viewings (travel time, buffer). The
    // slot engine subtracts this from the available window after expansion.
    bufferMin: { type: Number, min: 0, max: 240, default: 0 },

    // IANA timezone (e.g. 'Asia/Kuala_Lumpur'). Slot expansion is done in
    // this zone so DST transitions round-trip cleanly.
    timezone: { type: String, default: 'Asia/Kuala_Lumpur' },

    effectiveFrom: { type: Date, default: () => new Date() },
    effectiveTo: { type: Date, default: null },

    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

// Shape the common "load all of an owner's active rules" query.
availabilityRuleSchema.index({ owner: 1, 'scope.kind': 1, 'scope.listing': 1, weekday: 1 })

module.exports = mongoose.model('AvailabilityRule', availabilityRuleSchema)
