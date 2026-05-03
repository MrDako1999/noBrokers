import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MessageSkeleton from './MessageSkeleton';

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
    isLoading: messagesLoading,
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
          // Dedupe by server _id (already inserted via API ack) or by
          // clientId (still showing the optimistic bubble — replace it
          // in place so the bubble keeps its position).
          const incomingClientId = message.clientId || null;
          let replaced = false;
          const nextPages = prev.pages.map((p) => {
            const items = p.items.map((m) => {
              if (m._id === message._id) {
                replaced = true;
                return { ...message, status: 'sent' };
              }
              if (incomingClientId && m.clientId === incomingClientId) {
                replaced = true;
                return { ...message, status: 'sent' };
              }
              return m;
            });
            return { ...p, items };
          });
          if (replaced) return { ...prev, pages: nextPages };
          // Brand-new message from the other party — prepend.
          const next = { ...prev, pages: [...nextPages] };
          next.pages[0] = {
            ...next.pages[0],
            items: [{ ...message, status: 'sent' }, ...(next.pages[0]?.items || [])],
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

  // ---- Optimistic send plumbing ------------------------------------------
  // Composer fires these so the bubble is on screen the moment the user
  // hits send. We reconcile against the server in three phases:
  //   1. onOptimisticSend → push a temp bubble with status='sending'
  //   2. onOptimisticAck  → swap in the real server message (clock → tick)
  //   3. Pusher new-message → if it arrives first, dedupe in onNewMessage
  // Failed sends keep the bubble but switch to status='failed'.
  const insertOptimistic = useCallback(
    (optimistic) => {
      queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
        if (!prev) {
          // No pages yet — seed one so the optimistic message renders.
          return {
            pages: [{ items: [optimistic], hasMore: false, nextCursor: null }],
            pageParams: [undefined],
          };
        }
        const next = { ...prev, pages: [...prev.pages] };
        next.pages[0] = {
          ...next.pages[0],
          items: [optimistic, ...(next.pages[0]?.items || [])],
        };
        return next;
      });
    },
    [conversationId, queryClient],
  );

  const ackOptimistic = useCallback(
    (clientId, serverMessage) => {
      queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
        if (!prev) return prev;
        let replaced = false;
        const pages = prev.pages.map((p) => {
          const items = p.items.map((m) => {
            if (m.clientId === clientId || m._id === serverMessage._id) {
              replaced = true;
              return { ...serverMessage, status: 'sent' };
            }
            return m;
          });
          return { ...p, items };
        });
        if (replaced) return { ...prev, pages };
        // No matching optimistic (Pusher beat us) — server msg already
        // present, leave cache as-is.
        return prev;
      });
    },
    [conversationId, queryClient],
  );

  const failOptimistic = useCallback(
    (clientId) => {
      queryClient.setQueryData(['chat-messages', conversationId], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((p) => ({
            ...p,
            items: p.items.map((m) =>
              m.clientId === clientId ? { ...m, status: 'failed' } : m,
            ),
          })),
        };
      });
    },
    [conversationId, queryClient],
  );

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

        {messagesLoading && messages.length === 0 && <MessageSkeleton />}

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
          currentUser={user}
          presenceChannel={presenceChannelRef.current}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onAfterSend={onAfterSend}
          onOptimisticSend={insertOptimistic}
          onOptimisticAck={ackOptimistic}
          onOptimisticFail={failOptimistic}
        />
      )}
    </div>
  );
}

function Header({ counterpart, counterpartOnline, lastSeen, listing, myRole }) {
  // Subject convention (mirrors the inbox row):
  // - Buyer chats with a *property*. We promote the listing (title +
  //   cover image) to the primary slot. The owner's name + presence dot
  //   live in a small secondary line so the user still knows there's a
  //   real human behind it.
  // - Owner sees the *buyer* as the primary subject (one buyer per
  //   thread). The listing pill below provides the property context.
  if (myRole === 'buyer') {
    return <BuyerHeader listing={listing} owner={counterpart} ownerOnline={counterpartOnline} lastSeen={lastSeen} />;
  }
  return <OwnerHeader counterpart={counterpart} counterpartOnline={counterpartOnline} lastSeen={lastSeen} listing={listing} />;
}

function BuyerHeader({ listing, owner, ownerOnline, lastSeen }) {
  const cover = listing?.images?.[0]?.url;
  const ownerName = owner?.name || 'Owner';
  const presenceLabel = ownerOnline
    ? 'Online'
    : lastSeen
      ? `last seen ${timeAgo(lastSeen)}`
      : 'offline';
  return (
    <div className="border-b border-sectionBorder px-3 py-2">
      <Link
        to={listing ? `/listings/${listing._id}` : '#'}
        className="flex items-center gap-2.5 rounded-lg p-1 -m-1 hover:bg-accent/40"
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {listing?.title || 'Property'}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                ownerOnline ? 'bg-success' : 'bg-muted-foreground/40'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">
              {ownerName} · {presenceLabel}
            </span>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}

function OwnerHeader({ counterpart, counterpartOnline, lastSeen, listing }) {
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
            <div className="text-[10px] text-muted-foreground">Your listing</div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
