const mongoose = require('mongoose')

// Append-only trail of counter-proposals on a viewing. Each entry freezes
// the (startAt, endAt) pair that the actor suggested so we can render a
// full timeline without second-guessing the schema.
const proposalSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'buyer'], required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    message: { type: String, default: '', maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const viewingSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    mode: { type: String, enum: ['in_person', 'virtual'], default: 'in_person' },

    // Current agreed-upon window. For `counter_proposed` viewings this is
    // the latest proposal; for `accepted` it's locked in.
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, default: 'Asia/Kuala_Lumpur' },

    status: {
      type: String,
      enum: [
        'requested',
        'accepted',
        'declined',
        'counter_proposed',
        'cancelled',
        'completed',
        'no_show',
        'expired',
      ],
      default: 'requested',
      index: true,
    },

    proposals: { type: [proposalSchema], default: [] },
    acceptedProposalId: { type: mongoose.Schema.Types.ObjectId, default: null },

    notes: { type: String, default: '', maxlength: 1000 },

    // Reserved for the future chat feature — a Thread id once we wire it up.
    // Kept nullable + untyped ref so the chat ships without a migration.
    thread: { type: mongoose.Schema.Types.ObjectId, default: null },

    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

// Inbox + calendar queries.
viewingSchema.index({ owner: 1, startAt: 1 })
viewingSchema.index({ buyer: 1, startAt: 1 })
viewingSchema.index({ listing: 1, startAt: 1 })

// Double-booking guard. The unique partial index only fires for `accepted`
// viewings, so an owner can have multiple overlapping `requested` /
// `counter_proposed` rows without conflict. Race-condition safety net —
// the viewings service also checks for overlap in a transaction.
viewingSchema.index(
  { owner: 1, startAt: 1, endAt: 1 },
  { unique: true, partialFilterExpression: { status: 'accepted' } },
)

module.exports = mongoose.model('Viewing', viewingSchema)
