import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Building2, ArrowLeft } from 'lucide-react';
import useChatStore from '@/stores/chatStore';
import useAuthStore from '@/stores/authStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import ConversationView from '@/components/chat/ConversationView';

// Full-page Messages inbox. Mirrors the floating widget's UX but laid out
// as a two-pane Slack/iMessage view on desktop (inbox left, conversation
// right) and stacked on mobile. Reuses ConversationView for the active
// conversation panel; the inbox here is its own component because the
// widget's ConversationList is sized for the 380px popover and doesn't
// look right at full width.

export default function MessagesPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const conversations = useChatStore((s) => s.conversations);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadInbox = useChatStore((s) => s.loadInbox);

  // Refresh inbox on mount + every 30s while page is open. We deliberately
  // do NOT touch the widget's `isOpen` state — the page is the surface,
  // and the floating bubble stays out of the way.
  useEffect(() => {
    loadInbox();
    const id = setInterval(loadInbox, 30 * 1000);
    return () => clearInterval(id);
  }, [loadInbox]);

  useEffect(() => {
    document.title = 'Messages — noBrokers.my';
  }, []);

  // The selected conversation comes from the URL so deep-links and
  // browser back/forward work. Falls back to the first conversation on
  // desktop when none is in the URL.
  const activeId = routeId || null;
  const activeConv = useMemo(
    () => conversations.find((c) => c._id === activeId) || null,
    [conversations, activeId],
  );

  const select = (id) => {
    navigate(`/dashboard/messages/${id}`);
  };

  const back = () => {
    navigate('/dashboard/messages');
  };

  // Mobile: show inbox OR conversation, not both. Desktop: two-pane.
  // We use Tailwind responsive classes; CSS handles the swap so no JS
  // viewport detection is needed.
  const showConversationOnMobile = !!activeId;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Talk to {user?.role === 'admin' ? 'anyone on' : 'buyers and owners across'} noBrokers — every offer, viewing, and reply lives here.
          </p>
        </div>
      </header>

      <div
        className="
          grid overflow-hidden rounded-2xl border border-sectionBorder bg-card
          h-[calc(100vh-220px)] min-h-[500px]
          md:grid-cols-[320px_1fr]
        "
      >
        {/* Inbox pane */}
        <aside
          className={cn(
            'border-sectionBorder min-h-0 md:border-r',
            showConversationOnMobile ? 'hidden md:flex md:flex-col' : 'flex flex-col',
          )}
        >
          <Inbox
            conversations={conversations}
            activeId={activeId}
            isLoading={isLoading}
            onSelect={select}
          />
        </aside>

        {/* Conversation pane */}
        <section
          className={cn(
            'min-h-0 min-w-0',
            showConversationOnMobile ? 'flex flex-col' : 'hidden md:flex md:flex-col',
          )}
        >
          {activeId ? (
            <>
              <div className="flex items-center gap-2 border-b border-sectionBorder px-3 py-2 md:hidden">
                <button
                  type="button"
                  aria-label="Back to inbox"
                  onClick={back}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="font-heading font-semibold truncate">
                  {activeConv?.counterpart?.name || 'Chat'}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ConversationView conversationId={activeId} />
              </div>
            </>
          ) : (
            <EmptyConversationState />
          )}
        </section>
      </div>
    </div>
  );
}

function Inbox({ conversations, activeId, isLoading, onSelect }) {
  const ownedGroups = useMemo(() => {
    const owned = conversations.filter((c) => c.myRole === 'owner');
    const map = new Map();
    for (const c of owned) {
      const lid = c.listing?._id || 'unknown';
      if (!map.has(lid)) map.set(lid, { listing: c.listing, items: [] });
      map.get(lid).items.push(c);
    }
    return Array.from(map.values());
  }, [conversations]);

  const asBuyer = useMemo(
    () => conversations.filter((c) => c.myRole === 'buyer'),
    [conversations],
  );

  if (isLoading && conversations.length === 0) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Loading conversations…
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
        <div>
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="font-heading font-semibold text-foreground mb-1">No messages yet</div>
          <p>
            Open any listing and tap “Chat with owner” to start a conversation. Buyers reaching out
            about your listings will also appear here.
          </p>
          <Link
            to="/buy"
            className="mt-4 inline-block text-xs text-primary hover:underline"
          >
            Browse properties →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {asBuyer.length > 0 && (
        <Section title="As buyer">
          {asBuyer.map((c) => (
            <Row key={c._id} conv={c} active={c._id === activeId} onSelect={() => onSelect(c._id)} />
          ))}
        </Section>
      )}

      {ownedGroups.map(({ listing, items }) => (
        <Section
          key={listing?._id || 'unknown'}
          title={listing?.title || 'Untitled listing'}
          subtitle={`${items.length} buyer${items.length === 1 ? '' : 's'}`}
        >
          {items.map((c) => (
            <Row
              key={c._id}
              conv={c}
              active={c._id === activeId}
              onSelect={() => onSelect(c._id)}
            />
          ))}
        </Section>
      ))}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-sectionBorder bg-card/95 px-3 py-2 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {title}
        </div>
        {subtitle && (
          <div className="shrink-0 text-[11px] text-muted-foreground">· {subtitle}</div>
        )}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ conv, active, onSelect }) {
  const counterpart = conv.counterpart;
  const initial = (counterpart?.name || '?')[0]?.toUpperCase();
  const unread = conv.unreadForMe || 0;
  const listing = conv.listing;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-start gap-3 border-b border-sectionBorder/60 px-3 py-3 text-left transition-colors focus:outline-none',
          active ? 'bg-primary/10' : 'hover:bg-accent/40 focus:bg-accent/40',
        )}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div
              className={cn(
                'truncate text-sm',
                unread ? 'font-semibold' : 'font-medium',
                active && 'text-primary',
              )}
            >
              {counterpart?.name || 'Unknown user'}
            </div>
            <div className="shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(conv.lastMessageAt)}
            </div>
          </div>
          {listing?.title && conv.myRole === 'buyer' && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {listing.title}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            <div
              className={cn(
                'truncate text-[12px]',
                unread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {conv.lastMessagePreview || 'No messages yet'}
            </div>
            {unread > 0 && (
              <span className="ml-auto grid min-w-[18px] h-[18px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function EmptyConversationState() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="font-heading font-semibold text-lg mb-1">Pick a conversation</div>
        <p className="text-sm text-muted-foreground">
          Choose a thread from the inbox on the left to keep talking. Offers, viewings and replies
          all show up in the same place.
        </p>
      </div>
    </div>
  );
}
