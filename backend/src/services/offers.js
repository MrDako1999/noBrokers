const Offer = require('../models/Offer.js')
const Listing = require('../models/Listing.js')
const chatService = require('./chat.js')

// Business logic for offers. Routes stay thin; service emits chat system
// events as a side-effect so the chat thread doubles as the activity log.

function err(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

async function emitChatEvent(offer, kind, payload) {
  try {
    const conversation = await chatService.getOrCreateConversation({
      listing: { _id: offer.listing, owner: offer.owner },
      buyerId: offer.buyer,
    })
    await chatService.linkEntity({ conversation, kind: 'offer', id: offer._id })
    await chatService.recordSystemEvent({
      conversation,
      kind,
      refModel: 'Offer',
      refId: offer._id,
      payload,
    })
  } catch (chatErr) {
    // Chat side-effects must NEVER break the offer write. Log + move on.
    console.error('chat sync failed for offer event:', kind, chatErr.message)
  }
}

async function createOffer({ listingId, buyerId, amount, message }) {
  if (!listingId || !amount) {
    throw err(400, 'Listing and amount are required')
  }
  const listing = await Listing.findById(listingId)
  if (!listing) throw err(404, 'Listing not found')
  if (listing.status !== 'active') {
    throw err(400, 'This listing is not accepting offers')
  }
  if (String(listing.owner) === String(buyerId)) {
    throw err(400, "You can't make an offer on your own listing")
  }

  const type = listing.listingType === 'sale' ? 'purchase' : 'rent'
  const askingPrice = listing.listingType === 'sale' ? listing.price : listing.monthlyRent

  const offer = await Offer.create({
    listing: listing._id,
    buyer: buyerId,
    owner: listing.owner,
    type,
    listingAskingPrice: askingPrice || 0,
    currentAmount: Number(amount),
    negotiations: [
      {
        from: buyerId,
        actorRole: 'buyer',
        amount: Number(amount),
        message: typeof message === 'string' ? message.trim() : '',
      },
    ],
    lastActivityAt: new Date(),
  })

  await emitChatEvent(offer, 'offer_made', {
    amount: offer.currentAmount,
    type: offer.type,
    askingPrice: offer.listingAskingPrice,
    message: typeof message === 'string' ? message.trim() : '',
    actorRole: 'buyer',
  })

  return offer
}

async function respondToOffer({ offerId, userId, action, amount, message }) {
  const offer = await Offer.findById(offerId)
  if (!offer) throw err(404, 'Offer not found')

  const isBuyer = String(offer.buyer) === String(userId)
  const isOwner = String(offer.owner) === String(userId)
  if (!isBuyer && !isOwner) throw err(403, 'Not allowed')

  if (['accepted', 'rejected', 'withdrawn'].includes(offer.status)) {
    throw err(400, 'This offer is already closed')
  }

  const actorRole = isBuyer ? 'buyer' : 'owner'
  let kind = null

  switch (action) {
    case 'counter': {
      if (!amount || Number(amount) <= 0) {
        throw err(400, 'Counter amount is required')
      }
      offer.negotiations.push({
        from: userId,
        actorRole,
        amount: Number(amount),
        message: typeof message === 'string' ? message.trim() : '',
      })
      offer.currentAmount = Number(amount)
      offer.status = 'countered'
      kind = 'offer_countered'
      break
    }
    case 'accept': {
      const last = offer.negotiations[offer.negotiations.length - 1]
      if (last && last.actorRole === actorRole) {
        throw err(400, 'You can only accept an offer the other party made')
      }
      offer.status = 'accepted'
      offer.negotiations.push({
        from: userId,
        actorRole,
        amount: offer.currentAmount,
        message: typeof message === 'string' ? message.trim() : 'Accepted',
      })
      kind = 'offer_accepted'
      break
    }
    case 'reject': {
      offer.status = 'rejected'
      offer.negotiations.push({
        from: userId,
        actorRole,
        amount: offer.currentAmount,
        message: typeof message === 'string' ? message.trim() : 'Rejected',
      })
      kind = 'offer_rejected'
      break
    }
    case 'withdraw': {
      if (!isBuyer) {
        throw err(400, 'Only the buyer can withdraw an offer')
      }
      offer.status = 'withdrawn'
      offer.negotiations.push({
        from: userId,
        actorRole,
        amount: offer.currentAmount,
        message: typeof message === 'string' ? message.trim() : 'Withdrawn',
      })
      kind = 'offer_withdrawn'
      break
    }
    default:
      throw err(400, 'Invalid action')
  }

  offer.lastActivityAt = new Date()
  await offer.save()

  await emitChatEvent(offer, kind, {
    amount: offer.currentAmount,
    type: offer.type,
    actorRole,
    message: typeof message === 'string' ? message.trim() : '',
  })

  return offer
}

module.exports = { createOffer, respondToOffer }
