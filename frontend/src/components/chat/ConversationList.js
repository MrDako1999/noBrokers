import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import useChatStore from '@/stores/chatStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

// Inbox view. For owners we group by listing (so a "kondo X" landlord sees
// all the buyer threads on that listing under one header). For buyers we
// just show a flat ordered list. The role decision is per-row, not
// per-user, so a hybrid (owner of A, buyer on B) sees both styles.
//
// Subject convention:
// - Buyer rows  → the *listing* is the subject (avatar = listing image,
//   title = listing.title). The owner's name is intentionally demoted to
//   a tiny secondary line — when a buyer messages a property, the
//   conversation is *about* the property, not the human owner.
// - Owner rows  → the *buyer* is the subject (one buyer-thread per row,
//   grouped under the listing header above).

export default function ConversationList() {
  const { conversations, isLoading, setActive, activeConversationId } = useChatStore();

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
    return <InboxSkeleton />;
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
        <Section title="Properties">
          {asBuyer.map((c) => (
            <BuyerRow
              key={c._id}
              conv={c}
              active={activeConversationId === c._id}
              onOpen={() => setActive(c._id)}
            />
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
            <OwnerRow
              key={c._id}
              conv={c}
              active={activeConversationId === c._id}
              onOpen={() => setActive(c._id)}
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
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground">· {subtitle}</div>}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

// Buyer-side row. Subject = the listing itself.
function BuyerRow({ conv, active, onOpen }) {
  const listing = conv.listing;
  const owner = conv.counterpart;
  const unread = conv.unreadForMe || 0;
  const cover = listing?.images?.[0]?.url;
  const title = listing?.title || 'Property';
  const ownerLabel = owner?.name ? `Owner · ${owner.name}` : 'Owner';

  return (
    <RowShell active={active} onOpen={onOpen}>
      {cover ? (
        <img
          src={cover}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <RowBody
        title={title}
        subtitle={ownerLabel}
        preview={conv.lastMessagePreview || 'No messages yet'}
        time={conv.lastMessageAt}
        unread={unread}
      />
    </RowShell>
  );
}

// Owner-side row. Subject = the buyer asking about your listing.
function OwnerRow({ conv, active, onOpen }) {
  const buyer = conv.counterpart;
  const initial = (buyer?.name || '?')[0]?.toUpperCase();
  const unread = conv.unreadForMe || 0;

  return (
    <RowShell active={active} onOpen={onOpen}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
        {initial}
      </div>
      <RowBody
        title={buyer?.name || 'Unknown buyer'}
        preview={conv.lastMessagePreview || 'No messages yet'}
        time={conv.lastMessageAt}
        unread={unread}
      />
    </RowShell>
  );
}

function RowShell({ active, onOpen, children }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 border-b border-sectionBorder/60 px-3 py-3 text-left transition-colors',
          'hover:bg-accent/40 focus:outline-none focus:bg-accent/40',
          active && 'bg-accent/60',
        )}
      >
        {children}
      </button>
    </li>
  );
}

function RowBody({ title, subtitle, preview, time, unread }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
          {title}
        </div>
        <div className="shrink-0 text-[11px] text-muted-foreground">
          {time ? timeAgo(time) : ''}
        </div>
      </div>
      {subtitle && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>
      )}
      <div className="mt-0.5 flex items-center gap-2">
        <div
          className={cn(
            'truncate text-[12px]',
            unread ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {preview}
        </div>
        {unread > 0 && (
          <span className="ml-auto grid min-w-[18px] h-[18px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
    </div>
  );
}

// Five shimmer rows — matches the typical first-page payload size, so
// the perceived layout shift on first response is minimal.
function InboxSkeleton() {
  return (
    <div className="h-full overflow-hidden" aria-hidden="true">
      <div className="border-b border-sectionBorder bg-card/95 px-3 py-2">
        <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
      </div>
      <ul>
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 border-b border-sectionBorder/60 px-3 py-3"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-secondary" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                <div className="h-2.5 w-10 animate-pulse rounded bg-secondary/70" />
              </div>
              <div className="h-2.5 w-20 animate-pulse rounded bg-secondary/70" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-secondary/60" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
