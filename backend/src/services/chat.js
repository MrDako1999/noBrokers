const mongoose = require('mongoose')
const Conversation = require('../models/Conversation.js')
const Message = require('../models/Message.js')
const Listing = require('../models/Listing.js')
const { triggerConversation } = require('../config/pusher.js')

// Service-level helpers shared between the chat routes and the
// offer/viewing services. Keeping the side-effects (DB writes + Pusher
// triggers) here means there's exactly one code path for "a message was
// added to a conversation".

// Get-or-create the canonical (listing, buyer) conversation, denormalising
// the owner from the listing. Throws a status-tagged error if buyer ===
// owner. Caller is expected to have already validated the listing exists.
async function getOrCreateConversation({ listing, buyerId }) {
  if (String(listing.owner) === String(buyerId)) {
    const err = new Error("You can't chat with yourself.")
    err.status = 400
    throw err
  }

  const existing = await Conversation.findOne({ listing: listing._id, buyer: buyerId })
  if (existing) return existing

  // upsert avoids a duplicate-key blow-up if two requests race here.
  const conv = await Conversation.findOneAndUpdate(
    { listing: listing._id, buyer: buyerId },
    {
      $setOnInsert: {
        listing: listing._id,
        buyer: buyerId,
        owner: listing.owner,
        lastMessageAt: new Date(),
        lastMessagePreview: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return conv
}

// Resolve the conversation for a given (listingId, buyerId), creating it
// on demand. Used by offer/viewing services that only have the listing
// and buyer ids.
async function ensureConversationForListing({ listingId, buyerId }) {
  const listing = await Listing.findById(listingId).select('owner').lean()
  if (!listing) {
    const err = new Error('Listing not found')
    err.status = 404
    throw err
  }
  return getOrCreateConversation({ listing, buyerId })
}

// Build a one-line preview for the inbox row. Plain text wins; otherwise
// fall back to attachment count or system-event copy.
function previewFor(message) {
  if (message.type === 'system') {
    return systemPreview(message.systemEvent) || 'Update'
  }
  if (message.body && message.body.trim()) {
    return message.body.trim().slice(0, 200)
  }
  if (message.attachments?.length) {
    const n = message.attachments.length
    return n === 1 ? '📎 Attachment' : `📎 ${n} attachments`
  }
  return ''
}

function systemPreview(evt) {
  if (!evt) return ''
  switch (evt.kind) {
    case 'offer_made':
      return 'Offer sent'
    case 'offer_countered':
      return 'Counter-offer'
    case 'offer_accepted':
      return 'Offer accepted'
    case 'offer_rejected':
      return 'Offer rejected'
    case 'offer_withdrawn':
      return 'Offer withdrawn'
    case 'viewing_requested':
      return 'Viewing requested'
    case 'viewing_accepted':
      return 'Viewing accepted'
    case 'viewing_declined':
      return 'Viewing declined'
    case 'viewing_cancelled':
      return 'Viewing cancelled'
    case 'viewing_proposed':
      return 'Counter-proposal'
    case 'viewing_completed':
      return 'Viewing completed'
    case 'viewing_no_show':
      return 'Viewing no-show'
    default:
      return 'Update'
  }
}

// Persist a user message + bump conversation counters + emit Pusher event.
// `bumpUnread` decides which side's unread counter ticks up. Defaults to
// "the other party from the sender", which is what regular sends want.
async function recordUserMessage({
  conversation,
  sender,
  senderRole,
  type,
  body,
  attachments,
  replyTo,
}) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    senderRole,
    type,
    body: typeof body === 'string' ? body.slice(0, 4000) : '',
    attachments: Array.isArray(attachments) ? attachments : [],
    replyTo: replyTo || null,
  })

  conversation.lastMessageAt = message.createdAt
  conversation.lastMessagePreview = previewFor(message)
  // Other party gets a +1.
  const counterpartKey = senderRole === 'buyer' ? 'owner' : 'buyer'
  conversation.unread[counterpartKey] = (conversation.unread[counterpartKey] || 0) + 1
  await conversation.save()

  const populated = await message.populate([
    { path: 'sender', select: 'name' },
    { path: 'replyTo', select: 'body type sender attachments deletedAt' },
  ])

  await triggerConversation(conversation._id, 'new-message', { message: populated })
  return populated
}

// Persist a system message + bump both sides' unread (since system events
// are equally relevant to both parties) + emit Pusher event.
async function recordSystemEvent({
  conversation,
  kind,
  refModel,
  refId,
  payload,
  bumpFor, // optional 'buyer' | 'owner' — bumps just that side's unread
}) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: null,
    senderRole: 'system',
    type: 'system',
    body: '',
    systemEvent: {
      kind,
      refModel,
      refId,
      payload: payload || {},
    },
  })

  conversation.lastMessageAt = message.createdAt
  conversation.lastMessagePreview = previewFor(message)
  if (bumpFor === 'buyer' || bumpFor === 'owner') {
    conversation.unread[bumpFor] = (conversation.unread[bumpFor] || 0) + 1
  } else {
    // Affect both inboxes — system events nudge everyone.
    conversation.unread.buyer = (conversation.unread.buyer || 0) + 1
    conversation.unread.owner = (conversation.unread.owner || 0) + 1
  }
  await conversation.save()

  await triggerConversation(conversation._id, 'new-message', { message })
  return message
}

// Update the linked offer/viewing pointer if not already set. We use
// $setOnInsert-style semantics: the pointer is a "first-seen" anchor so
// the chat header can deep-link into the most relevant entity.
async function linkEntity({ conversation, kind, id }) {
  const field = kind === 'offer' ? 'linkedOfferId' : 'linkedViewingId'
  if (conversation[field]) return conversation
  conversation[field] = id
  await conversation.save()
  return conversation
}

function partyRole(conversation, userId) {
  if (String(conversation.buyer) === String(userId)) return 'buyer'
  if (String(conversation.owner) === String(userId)) return 'owner'
  return null
}

function isParty(conversation, userId) {
  return partyRole(conversation, userId) !== null
}

function ensureValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

module.exports = {
  getOrCreateConversation,
  ensureConversationForListing,
  recordUserMessage,
  recordSystemEvent,
  linkEntity,
  partyRole,
  isParty,
  previewFor,
  systemPreview,
  ensureValidObjectId,
}
