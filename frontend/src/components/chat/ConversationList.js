import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import useChatStore from '@/stores/chatStore';
import useAuthStore from '@/stores/authStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

// Inbox view. For owners we group by listing (so a "kondo X" landlord sees
// all the buyer threads on that listing under one header). For buyers we
// just show a flat ordered list. The role decision is per-row, not
// per-user, so a hybrid (owner of A, buyer on B) sees both styles.

export default function ConversationList() {
  const { user } = useAuthStore();
  const { conversations, isLoading, setActive } = useChatStore();

  const ownedGroups = useMemo(() => {
    const owned = conversations.filter((c) => c.myRole === 'owner');
    const map = new Map();
    for (const conv of owned) {
      const lid = conv.listing?._id || 'unknown';
      if (!map.has(lid)) {
        map.set(lid, { listing: conv.listing, items: [] });
      }
      map.get(lid).items.push(conv);
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
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="font-heading font-semibold text-foreground mb-1">No conversations yet</div>
          <p>
            Tap “Chat with owner” on a listing to start one — or wait for a buyer to reach out about
            your property.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {asBuyer.length > 0 && (
        <Section title="As buyer">
          {asBuyer.map((c) => (
            <Row key={c._id} conv={c} onOpen={() => setActive(c._id)} />
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
            <Row key={c._id} conv={c} onOpen={() => setActive(c._id)} />
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
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground">· {subtitle}</div>}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ conv, onOpen }) {
  const counterpart = conv.counterpart;
  const initial = (counterpart?.name || '?')[0]?.toUpperCase();
  const unread = conv.unreadForMe || 0;
  const listing = conv.listing;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 border-b border-sectionBorder/60 px-3 py-3 text-left hover:bg-accent/40 focus:outline-none focus:bg-accent/40"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
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
