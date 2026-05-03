import { create } from 'zustand';
import api from '@/lib/api';
import { getPusher, disconnectPusher } from '@/lib/pusher';

// Global chat widget state. Holds the inbox snapshot, open/close UI
// state, the active conversation id, and a single Pusher subscription
// per conversation. The actual message lists live in TanStack Query
// caches (we lean on its infinite-query cursor handling); the store
// just orchestrates the side-effects.

let userInboxSubscription = null;
const conversationSubs = new Map();

function totalUnreadFrom(conversations) {
  return conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);
}

const useChatStore = create((set, get) => ({
  isOpen: false,
  isLoading: false,
  conversations: [],
  totalUnread: 0,
  // Conversation currently rendered in the panel (id, not the full row).
  activeConversationId: null,
  // Set of conversation ids that the widget has registered Pusher
  // listeners on so we don't double-bind when the user re-opens.
  // Listener payload-handlers live below in `subscribeToConversation`.

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, activeConversationId: null }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setActive: (id) => set({ activeConversationId: id }),

  // ---- Inbox -----------------------------------------------------------

  loadInbox: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/chat/conversations');
      set({
        conversations: data.items || [],
        totalUnread: totalUnreadFrom(data.items || []),
        isLoading: false,
      });
    } catch (err) {
      console.error('chat.loadInbox failed', err);
      set({ isLoading: false });
    }
  },

  reset: () => {
    // Tear down everything Pusher-related on logout.
    conversationSubs.forEach(({ channel, presence }) => {
      try {
        channel?.unbind_all();
        presence?.unbind_all();
        if (channel) getPusher().unsubscribe(channel.name);
        if (presence) getPusher().unsubscribe(presence.name);
      } catch {
        // ignore
      }
    });
    conversationSubs.clear();
    if (userInboxSubscription) {
      try {
        userInboxSubscription.unbind_all();
        getPusher().unsubscribe(userInboxSubscription.name);
      } catch {
        // ignore
      }
      userInboxSubscription = null;
    }
    disconnectPusher();
    set({
      isOpen: false,
      conversations: [],
      totalUnread: 0,
      activeConversationId: null,
    });
  },

  // Open (and create if needed) a conversation for a given listing, and
  // pop the widget panel.
  openForListing: async (listingId) => {
    try {
      const { data } = await api.post('/chat/conversations', { listingId });
      // Ensure it's in the inbox; if not, prepend it.
      const exists = get().conversations.find((c) => c._id === data.conversation._id);
      if (!exists) {
        const next = [data.conversation, ...get().conversations];
        set({ conversations: next, totalUnread: totalUnreadFrom(next) });
      }
      set({ isOpen: true, activeConversationId: data.conversation._id });
      return data.conversation;
    } catch (err) {
      console.error('chat.openForListing failed', err);
      throw err;
    }
  },

  // Mark caller as having read up to a given message id.
  markRead: async (conversationId, upToMessageId) => {
    try {
      await api.post(`/chat/conversations/${conversationId}/read`, { upToMessageId });
      const next = get().conversations.map((c) =>
        c._id === conversationId ? { ...c, unreadForMe: 0, unread: { ...(c.unread || {}), [c.myRole]: 0 } } : c,
      );
      set({ conversations: next, totalUnread: totalUnreadFrom(next) });
    } catch (err) {
      console.error('chat.markRead failed', err);
    }
  },

  // Called from Pusher handlers when an event lands on a conversation.
  // Updates the inbox row in place: bumps lastMessage, bumps unread (if
  // the user is not the sender and the conversation isn't currently open).
  applyIncomingMessage: (conversationId, message) => {
    const state = get();
    const idx = state.conversations.findIndex((c) => c._id === conversationId);
    let next;
    const me = currentUserId();
    if (idx === -1) {
      // Conversation we don't know about — refetch the inbox to pull it
      // in with full metadata.
      get().loadInbox();
      return;
    }
    const row = state.conversations[idx];
    const senderIsMe = message.sender && String(message.sender._id || message.sender) === String(me);
    const conversationOpen = state.isOpen && state.activeConversationId === conversationId;
    const bump = !senderIsMe && !conversationOpen ? 1 : 0;
    const updated = {
      ...row,
      lastMessageAt: message.createdAt || new Date().toISOString(),
      lastMessagePreview: previewFor(message),
      unreadForMe: (row.unreadForMe || 0) + bump,
    };
    // Move to the top.
    next = [updated, ...state.conversations.filter((_, i) => i !== idx)];
    set({ conversations: next, totalUnread: totalUnreadFrom(next) });
  },

  // Subscribe to a single conversation's private channel + presence. Handlers
  // are wired per-call so a remounting ConversationView always sees fresh
  // event payloads. We re-use the channel object across remounts so we
  // don't churn the Pusher connection.
  subscribeToConversation: (conversationId, handlers) => {
    const pusher = getPusher();
    let sub = conversationSubs.get(conversationId);
    if (!sub) {
      const channel = pusher.subscribe(`private-conversation-${conversationId}`);
      const presence = pusher.subscribe(`presence-conversation-${conversationId}`);
      sub = { channel, presence };
      conversationSubs.set(conversationId, sub);
    } else {
      // Drop the previous mount's bindings so the current handler set
      // wins (otherwise old closures would fire too).
      try {
        sub.channel.unbind_all();
        sub.presence.unbind_all();
      } catch {
        // ignore
      }
    }

    sub.channel.bind('new-message', (payload) => {
      handlers?.onNewMessage?.(payload.message);
      get().applyIncomingMessage(conversationId, payload.message);
    });
    sub.channel.bind('message-edited', (payload) => handlers?.onEdited?.(payload.message));
    sub.channel.bind('message-deleted', (payload) => handlers?.onDeleted?.(payload));
    sub.channel.bind('read-receipt', (payload) => handlers?.onRead?.(payload));

    // Presence subscription_succeeded only fires on initial subscribe;
    // for remounts we hydrate from `sub.presence.members.members` (the
    // pusher-js Members object) directly.
    sub.presence.bind('pusher:subscription_succeeded', (members) => {
      handlers?.onPresence?.({ event: 'sync', members: members.members });
    });
    sub.presence.bind('pusher:member_added', (member) => {
      handlers?.onPresence?.({ event: 'add', member });
    });
    sub.presence.bind('pusher:member_removed', (member) => {
      handlers?.onPresence?.({ event: 'remove', member });
    });
    sub.presence.bind('client-typing', (payload) => handlers?.onTyping?.(payload));

    // Catch up on presence members that were already there before we
    // (re)bound. pusher-js exposes them on `members` once subscribed.
    if (sub.presence.subscribed && sub.presence.members?.members) {
      handlers?.onPresence?.({
        event: 'sync',
        members: { ...sub.presence.members.members },
      });
    }
    return sub;
  },

  unsubscribeFromConversation: (conversationId) => {
    const sub = conversationSubs.get(conversationId);
    if (!sub) return;
    // Just drop the listeners — keep the channel subscribed so unread
    // bumps via `applyIncomingMessage` keep flowing into the inbox even
    // when the conversation panel is closed. The full teardown happens
    // on logout via `reset()`.
    try {
      sub.channel?.unbind_all();
      sub.presence?.unbind_all();
    } catch {
      // ignore
    }
    // Re-bind the inbox-only handler so closed conversations still bump.
    sub.channel?.bind('new-message', (payload) => {
      get().applyIncomingMessage(conversationId, payload.message);
    });
  },

  // After login (or first widget open), bind a private user-channel that
  // the inbox subscribes to so cross-conversation events (new conversation
  // created, lastMessage bumped) update the badge in real-time. We
  // implement this lightly: simply re-fetch the inbox when *any* of the
  // user's conversations fires a new-message and the conversation isn't
  // already in the local cache.
  ensureInboxLive: () => {
    // No-op for now — per-conversation subs already update the inbox via
    // applyIncomingMessage. Kept as an extension point for a future
    // user-scoped private channel (e.g. private-user-<id>).
  },
}));

function currentUserId() {
  // Lazy import avoids a circular: chatStore <- authStore wouldn't fly.
  // We read from localStorage's JWT *only* to pull the user id; the
  // authoritative source remains useAuthStore. Failure to parse falls
  // back to null which makes the bump check safer (treats us as the
  // recipient, which over-counts unread but never under-counts).
  try {
    const token = localStorage.getItem('nb-token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || null;
  } catch {
    return null;
  }
}

function previewFor(message) {
  if (!message) return '';
  if (message.deletedAt) return '🚫 Deleted';
  if (message.type === 'system') {
    return systemPreview(message.systemEvent);
  }
  if (message.body && message.body.trim()) return message.body.trim().slice(0, 200);
  if (message.attachments?.length) {
    const n = message.attachments.length;
    return n === 1 ? '📎 Attachment' : `📎 ${n} attachments`;
  }
  return '';
}

function systemPreview(evt) {
  if (!evt) return 'Update';
  switch (evt.kind) {
    case 'offer_made':
      return 'Offer sent';
    case 'offer_countered':
      return 'Counter-offer';
    case 'offer_accepted':
      return 'Offer accepted';
    case 'offer_rejected':
      return 'Offer rejected';
    case 'offer_withdrawn':
      return 'Offer withdrawn';
    case 'viewing_requested':
      return 'Viewing requested';
    case 'viewing_accepted':
      return 'Viewing accepted';
    case 'viewing_declined':
      return 'Viewing declined';
    case 'viewing_cancelled':
      return 'Viewing cancelled';
    case 'viewing_proposed':
      return 'Counter-proposal';
    case 'viewing_completed':
      return 'Viewing completed';
    case 'viewing_no_show':
      return 'Viewing no-show';
    default:
      return 'Update';
  }
}

export default useChatStore;
