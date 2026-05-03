const mongoose = require('mongoose')

// Sender can edit their own text messages within this window. Matches the
// 15-minute WhatsApp behaviour. Exported so routes / clients can show a
// matching countdown without re-deriving the constant.
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
    name: { type: String, default: '' },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
  },
  { _id: false },
)

// Lightweight per-recipient read marker. We only ever have two parties on
// a conversation, so this stays bounded.
const readBySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

// Structured metadata for system messages (offer/viewing lifecycle). The
// frontend renders different copy + inline action buttons by `kind`.
const systemEventSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true },
    refModel: { type: String, enum: ['Offer', 'Viewing'], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
)

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    // Null for system messages; required otherwise (validated in routes).
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderRole: {
      type: String,
      enum: ['buyer', 'owner', 'system'],
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'attachment', 'system'],
      required: true,
    },
    body: { type: String, default: '', maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },

    // Optional reply pointer. Frontend hydrates a tiny preview card from it.
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    editedAt: { type: Date, default: null },
    // Soft delete — body and attachments are wiped, type stays so the
    // bubble can render "This message was deleted" in place.
    deletedAt: { type: Date, default: null },

    readBy: { type: [readBySchema], default: [] },

    systemEvent: { type: systemEventSchema, default: null },
  },
  { timestamps: true },
)

// Default fetch order: newest first within a conversation.
messageSchema.index({ conversation: 1, createdAt: -1 })

const Message = mongoose.model('Message', messageSchema)
Message.MESSAGE_EDIT_WINDOW_MS = MESSAGE_EDIT_WINDOW_MS

module.exports = Message
module.exports.MESSAGE_EDIT_WINDOW_MS = MESSAGE_EDIT_WINDOW_MS
