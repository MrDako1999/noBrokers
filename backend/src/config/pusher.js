const Pusher = require('pusher')

// Cached Pusher client. Mirrors the lazy/cached pattern used by config/db
// and config/r2 so cold serverless invocations don't re-instantiate.
let cachedClient = null

function getPusherClient() {
  if (cachedClient) return cachedClient

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    throw new Error('Pusher is not configured (missing PUSHER_* env vars)')
  }

  cachedClient = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  })

  return cachedClient
}

// Trigger an event on a conversation's private channel. Errors are
// swallowed and logged because a Pusher hiccup must NEVER block the
// REST persistence path — the message is already in Mongo and the
// frontend will catch up on the next poll/refetch.
async function triggerConversation(conversationId, event, payload) {
  try {
    const client = getPusherClient()
    await client.trigger(`private-conversation-${conversationId}`, event, payload)
  } catch (err) {
    console.error(`pusher.trigger failed for ${conversationId}/${event}:`, err.message)
  }
}

// Used by `POST /api/chat/pusher/auth`. The route must verify the caller
// is party to the channel before delegating here.
function authorizeChannel(socketId, channelName, presenceData) {
  const client = getPusherClient()
  if (channelName.startsWith('presence-')) {
    if (!presenceData) {
      throw new Error('presenceData required for presence channels')
    }
    return client.authorizeChannel(socketId, channelName, presenceData)
  }
  return client.authorizeChannel(socketId, channelName)
}

module.exports = { getPusherClient, triggerConversation, authorizeChannel }
