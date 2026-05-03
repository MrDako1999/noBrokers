const express = require('express')
const mongoose = require('mongoose')
const Conversation = require('../models/Conversation.js')
const Message = require('../models/Message.js')
const Listing = require('../models/Listing.js')
const auth = require('../middleware/auth.js')
const chatService = require('../services/chat.js')
const { authorizeChannel, triggerConversation } = require('../config/pusher.js')
const { MESSAGE_EDIT_WINDOW_MS } = require('../models/Message.js')

const router = express.Router()

// Helpers ---------------------------------------------------------------

async function loadConversationOr404(id, res) {
  if (!chatService.ensureValidObjectId(id)) {
    res.status(404).json({ error: 'Conversation not found' })
    return null
  }
  const conv = await Conversation.findById(id)
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' })
    return null
  }
  return conv
}

function ensurePartyOr403(conv, user, res) {
  if (chatService.isParty(conv, user._id) || user.role === 'admin') return true
  res.status(403).json({ error: 'Not allowed' })
  return false
}

// Validate that an attachment object came from our own R2 prefix for this
// user. We don't need to round-trip to R2 — checking the key prefix is
// enough since the presign endpoint scopes keys to `chat/<userId>/...`.
function attachmentBelongsToUser(att, user) {
  if (!att || typeof att !== 'object') return false
  if (!att.url || !att.key) return false
  if (typeof att.key !== 'string') return false
  if (user.role === 'admin') return true
  return att.key.startsWith(`chat/${user._id}/`)
}

// Routes ----------------------------------------------------------------

// POST /api/chat/pusher/auth — Pusher channel authorization endpoint. The
// browser hits this whenever it subscribes to a private/presence channel.
// Body: { socket_id, channel_name }. We re-derive the conversation id
// from the channel name and verify the caller is a party before issuing
// the signed auth payload.
router.post('/pusher/auth', auth, async (req, res, next) => {
  try {
    const socketId = req.body.socket_id
    const channelName = req.body.channel_name
    if (!socketId || !channelName) {
      return res.status(400).json({ error: 'socket_id and channel_name required' })
    }

    const match = channelName.match(/^(private|presence)-conversation-([a-f0-9]{24})$/)
    if (!match) {
      return res.status(400).json({ error: 'Unsupported channel' })
    }
    const conversationId = match[2]
    const conv = await Conversation.findById(conversationId).select('buyer owner')
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })
    if (!chatService.isParty(conv, req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' })
    }

    let payload
    if (channelName.startsWith('presence-')) {
      payload = authorizeChannel(socketId, channelName, {
        user_id: String(req.user._id),
        user_info: { name: req.user.name },
      })
    } else {
      payload = authorizeChannel(socketId, channelName)
    }
    res.send(payload)
  } catch (err) {
    next(err)
  }
})

// GET /api/chat/conversations — caller's inbox.
// Returns conversations ordered by last activity, with the counterpart
// hydrated and the caller's own unread count surfaced as `unreadForMe`.
router.get('/conversations', auth, async (req, res, next) => {
  try {
    const me = req.user._id
    const items = await Conversation.find({ $or: [{ buyer: me }, { owner: me }] })
      .sort({ lastMessageAt: -1 })
      .limit(200)
      .populate('listing', 'title images listingType price monthlyRent location status owner')
      .populate('buyer', 'name lastSeenAt')
      .populate('owner', 'name lastSeenAt')
      .lean()

    const decorated = items.map((c) => {
      const role = String(c.buyer?._id || c.buyer) === String(me) ? 'buyer' : 'owner'
      const counterpart = role === 'buyer' ? c.owner : c.buyer
      return {
        ...c,
        myRole: role,
        counterpart,
        unreadForMe: c.unread?.[role] || 0,
      }
    })

    res.json({ items: decorated })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/conversations — open (or fetch) the conversation with a
// given listing. The caller is always the buyer; the owner is taken from
// the listing.
router.post('/conversations', auth, async (req, res, next) => {
  try {
    const { listingId } = req.body
    if (!listingId || !chatService.ensureValidObjectId(listingId)) {
      return res.status(400).json({ error: 'listingId is required' })
    }
    const listing = await Listing.findById(listingId).select('owner status')
    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    const conv = await chatService.getOrCreateConversation({
      listing,
      buyerId: req.user._id,
    })

    const populated = await Conversation.findById(conv._id)
      .populate('listing', 'title images listingType price monthlyRent location status owner')
      .populate('buyer', 'name lastSeenAt')
      .populate('owner', 'name lastSeenAt')
      .lean()

    const role = String(populated.buyer?._id) === String(req.user._id) ? 'buyer' : 'owner'
    const counterpart = role === 'buyer' ? populated.owner : populated.buyer

    res.status(201).json({
      conversation: {
        ...populated,
        myRole: role,
        counterpart,
        unreadForMe: populated.unread?.[role] || 0,
      },
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// GET /api/chat/conversations/:id — single conversation with linked
// offer/viewing populated.
router.get('/conversations/:id', auth, async (req, res, next) => {
  try {
    const conv = await loadConversationOr404(req.params.id, res)
    if (!conv) return
    if (!ensurePartyOr403(conv, req.user, res)) return

    const populated = await Conversation.findById(conv._id)
      .populate('listing', 'title images listingType price monthlyRent location status owner')
      .populate('buyer', 'name lastSeenAt')
      .populate('owner', 'name lastSeenAt')
      .populate('linkedOfferId', 'status currentAmount type')
      .populate('linkedViewingId', 'status startAt endAt mode')
      .lean()

    const role = String(populated.buyer?._id) === String(req.user._id) ? 'buyer' : 'owner'
    const counterpart = role === 'buyer' ? populated.owner : populated.buyer

    res.json({
      conversation: {
        ...populated,
        myRole: role,
        counterpart,
        unreadForMe: populated.unread?.[role] || 0,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/chat/conversations/:id/messages?before=<msgId>&limit=30
// Cursor-paginated, newest first. The frontend reverses the array to
// render bottom-to-top.
router.get('/conversations/:id/messages', auth, async (req, res, next) => {
  try {
    const conv = await loadConversationOr404(req.params.id, res)
    if (!conv) return
    if (!ensurePartyOr403(conv, req.user, res)) return

    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const filter = { conversation: conv._id }
    if (req.query.before) {
      if (!chatService.ensureValidObjectId(req.query.before)) {
        return res.status(400).json({ error: 'Invalid `before` cursor' })
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(req.query.before) }
    }

    const items = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('sender', 'name')
      .populate('replyTo', 'body type sender attachments deletedAt')
      .lean()

    res.json({
      items,
      hasMore: items.length === limit,
      nextCursor: items.length ? String(items[items.length - 1]._id) : null,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/conversations/:id/messages — send a regular (or
// attachment) message, OR dispatch an inline action (offer/viewing).
//
// Body: { body?, attachments?, replyToId?, action? }
//
// `action` shape:
//   { kind: 'offer.create',  amount, message? }
//   { kind: 'offer.respond', offerId, decision: 'counter'|'accept'|'reject'|'withdraw', amount?, message? }
//   { kind: 'viewing.create',  startAt, endAt, mode?, notes? }
//   { kind: 'viewing.respond', viewingId, decision: 'accept'|'decline'|'cancel'|'propose'|'accept-proposal'|'complete'|'no-show', startAt?, endAt?, message?, proposalId? }
router.post('/conversations/:id/messages', auth, async (req, res, next) => {
  try {
    const conv = await loadConversationOr404(req.params.id, res)
    if (!conv) return
    if (!ensurePartyOr403(conv, req.user, res)) return

    const role = chatService.partyRole(conv, req.user._id)
    if (!role) {
      return res.status(403).json({ error: 'Only conversation parties can send' })
    }

    const { body, attachments, replyToId, action } = req.body

    // --- Inline action dispatcher (offer / viewing) ---------------------
    if (action && typeof action === 'object') {
      const result = await runActionFromChat({ conv, role, user: req.user, action })
      if (result?.error) {
        return res.status(result.status || 400).json({ error: result.error })
      }
      // Refetch the latest message so the client gets a stable shape.
      const latest = await Message.findOne({ conversation: conv._id })
        .sort({ _id: -1 })
        .populate('sender', 'name')
        .populate('replyTo', 'body type sender attachments deletedAt')
        .lean()
      return res.status(201).json({ message: latest, action: result?.entity || null })
    }

    // --- Regular text / attachment message ------------------------------
    const cleanBody = typeof body === 'string' ? body.trim() : ''
    const cleanAttachments = Array.isArray(attachments) ? attachments : []

    if (!cleanBody && cleanAttachments.length === 0) {
      return res.status(400).json({ error: 'Message must include text or attachments' })
    }
    for (const att of cleanAttachments) {
      if (!attachmentBelongsToUser(att, req.user)) {
        return res.status(400).json({ error: 'Invalid attachment payload' })
      }
    }

    let replyTo = null
    if (replyToId) {
      if (!chatService.ensureValidObjectId(replyToId)) {
        return res.status(400).json({ error: 'Invalid replyToId' })
      }
      const target = await Message.findById(replyToId).select('conversation')
      if (!target || String(target.conversation) !== String(conv._id)) {
        return res.status(400).json({ error: 'replyTo must belong to this conversation' })
      }
      replyTo = target._id
    }

    const message = await chatService.recordUserMessage({
      conversation: conv,
      sender: req.user,
      senderRole: role,
      type: cleanAttachments.length ? 'attachment' : 'text',
      body: cleanBody,
      attachments: cleanAttachments,
      replyTo,
    })

    res.status(201).json({ message })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// PATCH /api/chat/messages/:id — edit own text message within window.
router.patch('/messages/:id', auth, async (req, res, next) => {
  try {
    if (!chatService.ensureValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Message not found' })
    }
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: 'Message not found' })
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You can only edit your own messages' })
    }
    if (message.deletedAt) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' })
    }
    if (message.type !== 'text') {
      return res.status(400).json({ error: 'Only text messages can be edited' })
    }
    const age = Date.now() - new Date(message.createdAt).getTime()
    if (age > MESSAGE_EDIT_WINDOW_MS) {
      return res.status(400).json({ error: 'Edit window has passed' })
    }

    const { body } = req.body
    if (typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'New body required' })
    }

    message.body = body.trim().slice(0, 4000)
    message.editedAt = new Date()
    await message.save()

    // Update the inbox preview if this was the latest message.
    const conv = await Conversation.findById(message.conversation)
    if (conv) {
      const latest = await Message.findOne({ conversation: conv._id }).sort({ _id: -1 })
      if (latest && String(latest._id) === String(message._id)) {
        conv.lastMessagePreview = chatService.previewFor(message)
        await conv.save()
      }
    }

    const populated = await Message.findById(message._id)
      .populate('sender', 'name')
      .populate('replyTo', 'body type sender attachments deletedAt')
      .lean()

    await triggerConversation(message.conversation, 'message-edited', { message: populated })
    res.json({ message: populated })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/chat/messages/:id — soft delete-for-everyone (sender only).
router.delete('/messages/:id', auth, async (req, res, next) => {
  try {
    if (!chatService.ensureValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Message not found' })
    }
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: 'Message not found' })
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You can only delete your own messages' })
    }
    if (message.deletedAt) {
      return res.json({ message: { _id: message._id, deletedAt: message.deletedAt } })
    }

    message.deletedAt = new Date()
    message.body = ''
    message.attachments = []
    await message.save()

    // Refresh inbox preview if this was the most recent message.
    const conv = await Conversation.findById(message.conversation)
    if (conv) {
      const latest = await Message.findOne({ conversation: conv._id }).sort({ _id: -1 })
      if (latest && String(latest._id) === String(message._id)) {
        conv.lastMessagePreview = '🚫 Deleted'
        await conv.save()
      }
    }

    await triggerConversation(message.conversation, 'message-deleted', {
      messageId: String(message._id),
      deletedAt: message.deletedAt,
    })
    res.json({ message: { _id: message._id, deletedAt: message.deletedAt } })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/conversations/:id/read — mark messages up to a given id
// as read by the caller, and zero the caller's unread counter.
router.post('/conversations/:id/read', auth, async (req, res, next) => {
  try {
    const conv = await loadConversationOr404(req.params.id, res)
    if (!conv) return
    const role = chatService.partyRole(conv, req.user._id)
    if (!role) return res.status(403).json({ error: 'Not allowed' })

    const { upToMessageId } = req.body
    let cutoff = null
    if (upToMessageId) {
      if (!chatService.ensureValidObjectId(upToMessageId)) {
        return res.status(400).json({ error: 'Invalid upToMessageId' })
      }
      cutoff = new mongoose.Types.ObjectId(upToMessageId)
    }

    const filter = {
      conversation: conv._id,
      sender: { $ne: req.user._id },
      'readBy.user': { $ne: req.user._id },
    }
    if (cutoff) filter._id = { $lte: cutoff }

    await Message.updateMany(filter, {
      $push: { readBy: { user: req.user._id, at: new Date() } },
    })

    conv.unread[role] = 0
    await conv.save()

    await triggerConversation(conv._id, 'read-receipt', {
      userId: String(req.user._id),
      role,
      upToMessageId: upToMessageId ? String(upToMessageId) : null,
      at: new Date().toISOString(),
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/conversations/:id/typing — REST fallback for typing
// notifications. Most clients should use Pusher's `client-typing` events
// directly on the presence channel; this stays as a no-friction backup.
router.post('/conversations/:id/typing', auth, async (req, res, next) => {
  try {
    const conv = await loadConversationOr404(req.params.id, res)
    if (!conv) return
    const role = chatService.partyRole(conv, req.user._id)
    if (!role) return res.status(403).json({ error: 'Not allowed' })

    await triggerConversation(conv._id, 'typing', {
      userId: String(req.user._id),
      role,
      at: new Date().toISOString(),
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- Inline action dispatcher ----------------------------------------------
// Translates an `action` from the chat composer into a call against the
// existing offer/viewing services. The services themselves emit the
// system-message + Pusher event, so we don't double-record here.

async function runActionFromChat({ conv, role, user, action }) {
  const offerService = require('../services/offers.js')
  const viewingService = require('../services/viewings.js')

  try {
    if (action.kind === 'offer.create') {
      if (role !== 'buyer') return { status: 403, error: 'Only the buyer can make an offer' }
      const offer = await offerService.createOffer({
        listingId: conv.listing,
        buyerId: user._id,
        amount: action.amount,
        message: action.message,
      })
      return { entity: { kind: 'offer', id: offer._id } }
    }
    if (action.kind === 'offer.respond') {
      const offer = await offerService.respondToOffer({
        offerId: action.offerId,
        userId: user._id,
        action: action.decision,
        amount: action.amount,
        message: action.message,
      })
      return { entity: { kind: 'offer', id: offer._id } }
    }
    if (action.kind === 'viewing.create') {
      if (role !== 'buyer') return { status: 403, error: 'Only the buyer can request a viewing' }
      const viewing = await viewingService.createRequestFromIds({
        listingId: conv.listing,
        buyerId: user._id,
        startAt: action.startAt,
        endAt: action.endAt,
        mode: action.mode,
        notes: action.notes,
      })
      return { entity: { kind: 'viewing', id: viewing._id } }
    }
    if (action.kind === 'viewing.respond') {
      const viewing = await viewingService.respondFromChat({
        viewingId: action.viewingId,
        userId: user._id,
        decision: action.decision,
        startAt: action.startAt,
        endAt: action.endAt,
        message: action.message,
        proposalId: action.proposalId,
      })
      return { entity: { kind: 'viewing', id: viewing._id } }
    }
    return { status: 400, error: 'Unknown action kind' }
  } catch (err) {
    return { status: err.status || 500, error: err.message || 'Action failed' }
  }
}

module.exports = router
