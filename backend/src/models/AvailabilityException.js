const mongoose = require('mongoose')

// One-off overrides on top of the weekly `AvailabilityRule` set — either
// blocking a window (holiday, travel) or opening one that the weekly rules
// would otherwise exclude (e.g. "I'll make an exception this Sunday").
const availabilityExceptionSchema = new mongoose.Schema(
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
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    kind: { type: String, enum: ['block', 'open'], required: true },
    reason: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: true },
)

availabilityExceptionSchema.index({ owner: 1, startAt: 1 })

module.exports = mongoose.model('AvailabilityException', availabilityExceptionSchema)
