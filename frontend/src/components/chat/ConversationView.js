import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import useChatStore from '@/stores/chatStore';
import { timeAgo } from '@/lib/format';
import MessageBubble from './MessageBubble';
import SystemMessage from './SystemMessage';
import Composer from './Composer';

// Renders header + messages list + composer. Owns:
//   - the messages query (infinite, cursor-paginated, oldest at top)
//   - the Pusher subscription via chatStore.subscribeToConversation
//   - presence tracking (online dot + typing indicator)
//   - mark-read when new messages land while panel is visible

export default function ConversationView({ conversationId }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { subscribeToConversation, unsubscribeFromConversation, markRead } = useChatStore();
  const [replyTo, setReplyTo] = useState(null);
  const [presenceMembers, setPresenceMembers] = useState({});
  const [typingFrom, setTypingFrom] = useState(null);
  const typingTimer = useRef(null);
  const scrollRef = useRef(null);
  const lastMarkedRef = useRef(null);
  const presenceChannelRef = useRef(null);

  // ---- Conversation summary (header) -----------------------------------
  const { data: convData } = useQuery({
    queryKey: ['chat-conversation', conversationId],
    queryFn: async () => {
      const { data } = await api.get(`/chat/conversations/${conversationId}`);
      return data.conversation;
    },
  });

  // ---- Messages (infinite) ---------------------------------------------
  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, {
        params: { before: pageParam, limit: 30 },
      });
      return data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    initialPageParam: undefined,
  });

  // Flatten + reverse so oldest is at top, newest at bottom.
  const messages = useMemo(() => {
    if (!pages) return [];
    const flat = pages.pages.flatMap((p) => p.items || []);
    // Items come newest-first within each page; reverse the whole thing.
    return [...flat].reverse();
  }, [pages]);

  // ---- Pusher subscription -----------------------------------------------
  useEffect(() => {
    const sub = subscribeToConversation(conversationId, {
      onNewMessage: (message) => {
        queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
          if (!prev) return prev;
          // Avoid double-adding if we already optimistically saw it.
          const seen = prev.pages.some((p) => p.items.some((m) => m._id === message._id));
          if (seen) return prev;
          const next = { ...prev, pages: [...prev.pages] };
          next.pages[0] = {
            ...next.pages[0],
            items: [message, ...(next.pages[0]?.items || [])],
          };
          return next;
        });
      },
      onEdited: (message) => {
        queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((m) => (m._id === message._id ? { ...m, ...message } : m)),
            })),
          };
        });
      },
      onDeleted: ({ messageId, deletedAt }) => {
        queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((m) =>
                m._id === messageId
                  ? { ...m, deletedAt, body: '', attachments: [] }
                  : m,
              ),
            })),
          };
        });
      },
      onRead: ({ userId, upToMessageId }) => {
        queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((m) => {
                if (upToMessageId && m._id > upToMessageId) return m;
                if (m.readBy?.some((r) => String(r.user?._id || r.user) === String(userId))) return m;
                return {
                  ...m,
                  readBy: [...(m.readBy || []), { user: userId, at: new Date().toISOString() }],
                };
              }),
            })),
          };
        });
      },
      onPresence: ({ event, members, member }) => {
        if (event === 'sync') setPresenceMembers({ ...members });
        if (event === 'add') setPresenceMembers((prev) => ({ ...prev, [member.id]: member.info }));
        if (event === 'remove')
          setPresenceMembers((prev) => {
            const next = { ...prev };
            delete next[member.id];
            return next;
          });
      },
      onTyping: (payload) => {
        // Ignore my own typing events (they bounce back via Pusher).
        if (String(payload?.userId || '') === String(user?._id)) return;
        setTypingFrom(payload?.userId || 'them');
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingFrom(null), 4000);
      },
    });
    presenceChannelRef.current = sub?.presence || null;

    return () => {
      clearTimeout(typingTimer.current);
      unsubscribeFromConversation(conversationId);
      presenceChannelRef.current = null;
    };
  }, [conversationId, subscribeToConversation, unsubscribeFromConversation, queryClient, user?._id]);

  // ---- Mark-read on view + on incoming -----------------------------------
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return;
    if (lastMarkedRef.current === latest._id) return;
    if (String(latest.sender?._id || latest.sender) === String(user?._id)) {
      lastMarkedRef.current = latest._id;
      return;
    }
    lastMarkedRef.current = latest._id;
    markRead(conversationId, latest._id);
  }, [messages, conversationId, markRead, user?._id]);

  // ---- Auto-scroll to bottom on new -------------------------------------
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    // Only auto-scroll if user is near bottom already, otherwise respect
    // their position (e.g. they're scrolling up to read history).
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages.length]);

  const onAfterSend = () => {
    // Newest message lands via Pusher; nudge scroll regardless.
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const counterpart = convData?.counterpart;
  const counterpartId = counterpart?._id;
  const counterpartOnline = counterpartId
    ? !!presenceMembers[String(counterpartId)]
    : false;
  const lastSeen = counterpart?.lastSeenAt;
  const listing = convData?.listing;

  return (
    <div className="flex h-full flex-col">
      <Header
        counterpart={counterpart}
        counterpartOnline={counterpartOnline}
        lastSeen={lastSeen}
        listing={listing}
        myRole={convData?.myRole}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto py-2">
        {hasNextPage && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              className="rounded-full px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {messages.map((m) => {
          if (m.type === 'system') {
            return (
              <SystemMessage
                key={m._id}
                message={m}
                myRole={convData?.myRole}
                conversationId={conversationId}
                onActioned={() => refetchMessages()}
              />
            );
          }
          const isMine = String(m.sender?._id || m.sender) === String(user?._id);
          return (
            <MessageBubble
              key={m._id}
              message={m}
              isMine={isMine}
              counterpartId={counterpartId}
              onReply={(target) => setReplyTo(target)}
              onLocalEdit={(updated) => {
                queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    pages: prev.pages.map((p) => ({
                      ...p,
                      items: p.items.map((x) => (x._id === updated._id ? updated : x)),
                    })),
                  };
                });
              }}
              onLocalDelete={(deleted) => {
                queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    pages: prev.pages.map((p) => ({
                      ...p,
                      items: p.items.map((x) =>
                        x._id === deleted._id
                          ? { ...x, deletedAt: deleted.deletedAt, body: '', attachments: [] }
                          : x,
                      ),
                    })),
                  };
                });
              }}
            />
          );
        })}

        {typingFrom && (
          <div className="px-3 pb-1 text-[11px] text-muted-foreground italic">typing…</div>
        )}
      </div>

      {convData && (
        <Composer
          conversation={convData}
          presenceChannel={presenceChannelRef.current}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onAfterSend={onAfterSend}
        />
      )}
    </div>
  );
}

function Header({ counterpart, counterpartOnline, lastSeen, listing, myRole }) {
  const initial = (counterpart?.name || '?')[0]?.toUpperCase();
  return (
    <div className="border-b border-sectionBorder px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">
            {initial}
          </div>
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
              counterpartOnline ? 'bg-success' : 'bg-muted-foreground/40'
            }`}
            title={counterpartOnline ? 'Online' : lastSeen ? `Last seen ${timeAgo(lastSeen)}` : 'Offline'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{counterpart?.name || 'Unknown'}</div>
          <div className="text-[11px] text-muted-foreground">
            {counterpartOnline
              ? 'Online'
              : lastSeen
                ? `Last seen ${timeAgo(lastSeen)}`
                : 'Offline'}
          </div>
        </div>
      </div>

      {listing && (
        <Link
          to={`/listings/${listing._id}`}
          className="mt-2 flex items-center gap-2 rounded-lg border border-sectionBorder bg-secondary/40 px-2 py-1.5 text-[12px] hover:bg-accent"
        >
          {listing.images?.[0]?.url ? (
            <img
              src={listing.images[0].url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{listing.title}</div>
            <div className="text-[10px] text-muted-foreground">
              {myRole === 'owner' ? 'Your listing' : 'View property'}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
