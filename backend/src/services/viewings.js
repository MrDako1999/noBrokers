const mongoose = require('mongoose')
const Viewing = require('../models/Viewing.js')
const Listing = require('../models/Listing.js')
const chatService = require('./chat.js')

// Business logic for the viewing lifecycle. Routes stay thin; service
// enforces the state machine and the "no two accepted viewings overlap"
// invariant (the unique partial index is the final safety net, but doing
// an explicit check lets us 409 before hitting Mongo). It also emits
// chat system events as a side-effect so the chat thread doubles as the
// viewing's activity log.
//
// State machine:
//   requested       -> accepted | declined | counter_proposed | cancelled | expired
//   counter_proposed-> accepted | declined | counter_proposed | cancelled | expired
//   accepted        -> cancelled | completed | no_show
//   declined/cancelled/completed/no_show/expired -> terminal

const TERMINAL = ['declined', 'cancelled', 'completed', 'no_show', 'expired']

function assertNotTerminal(viewing) {
  if (TERMINAL.includes(viewing.status)) {
    const err = new Error(`This viewing is already ${viewing.status}.`)
    err.status = 400
    throw err
  }
}

function actorRole(viewing, userId) {
  if (String(viewing.owner) === String(userId)) return 'owner'
  if (String(viewing.buyer) === String(userId)) return 'buyer'
  return null
}

async function emitChatEvent(viewing, kind, payload = {}) {
  try {
    const conversation = await chatService.getOrCreateConversation({
      listing: { _id: viewing.listing, owner: viewing.owner },
      buyerId: viewing.buyer,
    })
    await chatService.linkEntity({ conversation, kind: 'viewing', id: viewing._id })
    await chatService.recordSystemEvent({
      conversation,
      kind,
      refModel: 'Viewing',
      refId: viewing._id,
      payload: {
        startAt: viewing.startAt,
        endAt: viewing.endAt,
        mode: viewing.mode,
        status: viewing.status,
        ...payload,
      },
    })
  } catch (chatErr) {
    console.error('chat sync failed for viewing event:', kind, chatErr.message)
  }
}

async function overlapsAcceptedOther(ownerId, startAt, endAt, excludeId) {
  const query = {
    owner: ownerId,
    status: 'accepted',
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  }
  if (excludeId) query._id = { $ne: excludeId }
  return Viewing.exists(query)
}

// Create a fresh request. Overlap with other `accepted` viewings is a 409
// so the buyer can re-fetch slots and pick another time.
async function createRequest({ listing, buyerId, startAt, endAt, mode, notes, timezone }) {
  if (String(listing.owner) === String(buyerId)) {
    const err = new Error("You can't request a viewing on your own listing.")
    err.status = 400
    throw err
  }
  if (listing.status !== 'active') {
    const err = new Error('This listing is not accepting viewings.')
    err.status = 400
    throw err
  }

  const clash = await overlapsAcceptedOther(listing.owner, startAt, endAt)
  if (clash) {
    const err = new Error('That slot was just taken — pick another time.')
    err.status = 409
    throw err
  }

  const viewing = await Viewing.create({
    listing: listing._id,
    owner: listing.owner,
    buyer: buyerId,
    mode: mode === 'virtual' ? 'virtual' : 'in_person',
    startAt,
    endAt,
    timezone: timezone || 'Asia/Kuala_Lumpur',
    status: 'requested',
    notes: typeof notes === 'string' ? notes.slice(0, 1000) : '',
    lastActivityAt: new Date(),
  })
  await emitChatEvent(viewing, 'viewing_requested', {
    notes: typeof notes === 'string' ? notes.slice(0, 200) : '',
    actorRole: 'buyer',
  })
  return viewing
}

// Variant of `createRequest` that takes raw ids (used by chat dispatcher).
async function createRequestFromIds({ listingId, buyerId, startAt, endAt, mode, notes, timezone }) {
  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
    const err = new Error('listingId is required')
    err.status = 400
    throw err
  }
  const s = new Date(startAt)
  const e = new Date(endAt)
  if (isNaN(s) || isNaN(e) || e <= s) {
    const err = new Error('Invalid time window')
    err.status = 400
    throw err
  }
  const listing = await Listing.findById(listingId).select('owner status')
  if (!listing) {
    const err = new Error('Listing not found')
    err.status = 404
    throw err
  }
  return createRequest({ listing, buyerId, startAt: s, endAt: e, mode, notes, timezone })
}

async function acceptRequest(viewingId, userId) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  if (actorRole(viewing, userId) !== 'owner') {
    const err = new Error('Only the owner can accept a viewing request.')
    err.status = 403
    throw err
  }
  assertNotTerminal(viewing)
  if (viewing.status === 'accepted') return viewing

  // Pre-check before the save so we return a friendly 409 instead of a
  // raw duplicate-key error from the partial index.
  const clash = await overlapsAcceptedOther(viewing.owner, viewing.startAt, viewing.endAt, viewing._id)
  if (clash) {
    const err = new Error('Another accepted viewing overlaps this time.')
    err.status = 409
    throw err
  }

  viewing.status = 'accepted'
  viewing.acceptedProposalId = null
  viewing.lastActivityAt = new Date()
  try {
    await viewing.save()
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Another accepted viewing overlaps this time.')
      err.status = 409
      throw err
    }
    throw e
  }
  await emitChatEvent(viewing, 'viewing_accepted', { actorRole: 'owner' })
  return viewing
}

async function decline(viewingId, userId, reason) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  const role = actorRole(viewing, userId)
  if (!role) {
    const err = new Error('Not allowed.')
    err.status = 403
    throw err
  }
  assertNotTerminal(viewing)

  // Declining an already-accepted viewing is semantically "cancel". Keep
  // the terminology consistent: only pre-accepted flows produce "declined".
  if (viewing.status === 'accepted') {
    viewing.status = 'cancelled'
  } else {
    viewing.status = 'declined'
  }
  if (typeof reason === 'string' && reason.trim()) {
    viewing.notes = (viewing.notes ? viewing.notes + '\n' : '') + `[${role} ${viewing.status}]: ${reason.trim()}`
  }
  viewing.lastActivityAt = new Date()
  await viewing.save()
  const kind = viewing.status === 'cancelled' ? 'viewing_cancelled' : 'viewing_declined'
  await emitChatEvent(viewing, kind, {
    actorRole: role,
    reason: typeof reason === 'string' ? reason.trim().slice(0, 200) : '',
  })
  return viewing
}

async function cancel(viewingId, userId, reason) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  const role = actorRole(viewing, userId)
  if (!role) {
    const err = new Error('Not allowed.')
    err.status = 403
    throw err
  }
  assertNotTerminal(viewing)
  viewing.status = 'cancelled'
  if (typeof reason === 'string' && reason.trim()) {
    viewing.notes = (viewing.notes ? viewing.notes + '\n' : '') + `[${role} cancel]: ${reason.trim()}`
  }
  viewing.lastActivityAt = new Date()
  await viewing.save()
  await emitChatEvent(viewing, 'viewing_cancelled', {
    actorRole: role,
    reason: typeof reason === 'string' ? reason.trim().slice(0, 200) : '',
  })
  return viewing
}

async function propose(viewingId, userId, { startAt, endAt, message }) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  const role = actorRole(viewing, userId)
  if (!role) {
    const err = new Error('Not allowed.')
    err.status = 403
    throw err
  }
  assertNotTerminal(viewing)

  const s = new Date(startAt)
  const e = new Date(endAt)
  if (isNaN(s) || isNaN(e) || e <= s) {
    const err = new Error('Invalid proposed window.')
    err.status = 400
    throw err
  }

  viewing.proposals.push({
    by: userId,
    role,
    startAt: s,
    endAt: e,
    message: typeof message === 'string' ? message.slice(0, 500) : '',
  })
  viewing.status = 'counter_proposed'
  // Surface the latest proposal on the main doc so inbox queries stay
  // chronological. We do NOT mark this as the "accepted" window — that
  // requires the other side to accept explicitly.
  viewing.startAt = s
  viewing.endAt = e
  viewing.lastActivityAt = new Date()
  await viewing.save()
  await emitChatEvent(viewing, 'viewing_proposed', {
    actorRole: role,
    message: typeof message === 'string' ? message.slice(0, 200) : '',
    proposedStartAt: s,
    proposedEndAt: e,
  })
  return viewing
}

async function acceptProposal(viewingId, proposalId, userId) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  const role = actorRole(viewing, userId)
  if (!role) {
    const err = new Error('Not allowed.')
    err.status = 403
    throw err
  }
  assertNotTerminal(viewing)

  const proposal = viewing.proposals.id(proposalId)
  if (!proposal) {
    const err = new Error('Proposal not found')
    err.status = 404
    throw err
  }
  if (proposal.role === role) {
    const err = new Error('Only the other party can accept a proposal.')
    err.status = 400
    throw err
  }

  const clash = await overlapsAcceptedOther(viewing.owner, proposal.startAt, proposal.endAt, viewing._id)
  if (clash) {
    const err = new Error('Another accepted viewing overlaps this time.')
    err.status = 409
    throw err
  }

  viewing.status = 'accepted'
  viewing.startAt = proposal.startAt
  viewing.endAt = proposal.endAt
  viewing.acceptedProposalId = proposal._id
  viewing.lastActivityAt = new Date()
  try {
    await viewing.save()
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Another accepted viewing overlaps this time.')
      err.status = 409
      throw err
    }
    throw e
  }
  await emitChatEvent(viewing, 'viewing_accepted', { actorRole: role })
  return viewing
}

async function markOutcome(viewingId, userId, outcome) {
  const viewing = await Viewing.findById(viewingId)
  if (!viewing) {
    const err = new Error('Viewing not found')
    err.status = 404
    throw err
  }
  if (actorRole(viewing, userId) !== 'owner') {
    const err = new Error('Only the owner marks the outcome.')
    err.status = 403
    throw err
  }
  if (viewing.status !== 'accepted') {
    const err = new Error('Outcome can only be set on an accepted viewing.')
    err.status = 400
    throw err
  }
  if (!['completed', 'no_show'].includes(outcome)) {
    const err = new Error('Invalid outcome.')
    err.status = 400
    throw err
  }
  viewing.status = outcome
  viewing.lastActivityAt = new Date()
  await viewing.save()
  const kind = outcome === 'completed' ? 'viewing_completed' : 'viewing_no_show'
  await emitChatEvent(viewing, kind, { actorRole: 'owner' })
  return viewing
}

// Single dispatcher used by the chat composer's inline "viewing" actions.
// Wraps the appropriate state-machine transition by `decision`.
async function respondFromChat({
  viewingId,
  userId,
  decision,
  startAt,
  endAt,
  message,
  proposalId,
}) {
  switch (decision) {
    case 'accept':
      return acceptRequest(viewingId, userId)
    case 'decline':
      return decline(viewingId, userId, message)
    case 'cancel':
      return cancel(viewingId, userId, message)
    case 'propose':
      return propose(viewingId, userId, { startAt, endAt, message })
    case 'accept-proposal':
      return acceptProposal(viewingId, proposalId, userId)
    case 'complete':
      return markOutcome(viewingId, userId, 'completed')
    case 'no-show':
      return markOutcome(viewingId, userId, 'no_show')
    default: {
      const err = new Error('Invalid viewing decision')
      err.status = 400
      throw err
    }
  }
}

module.exports = {
  createRequest,
  createRequestFromIds,
  acceptRequest,
  decline,
  cancel,
  propose,
  acceptProposal,
  markOutcome,
  respondFromChat,
  actorRole,
}
