import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Home, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import api from '@/lib/api';
import { formatInZone } from '@/lib/format';
import { VIEWING_STATUS_LABELS, VIEWING_STATUS_VARIANTS } from '@/lib/constants';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';

// Unified inbox for viewings. One page serves both buyer and seller modes —
// the side filter defaults to the current dashboard mode but the user can
// cross-check the other side anytime (useful for admins and for users who
// wear both hats).
export default function ViewingsPage() {
  const { user } = useAuthStore();
  const { mode } = useModeStore();

  const enrolled = !!user?.sellerProfile?.enrolled || user?.role === 'admin';
  const defaultSide = mode === 'seller' && enrolled ? 'owner' : 'buyer';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight inline-flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Viewings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track every viewing request you send or receive. The owner has final say on
          accepting, declining, or proposing a different time.
        </p>
      </div>

      <Tabs defaultValue={defaultSide}>
        <TabsList>
          <TabsTrigger value="buyer">
            <UserIcon className="h-3.5 w-3.5 mr-1.5" />
            As buyer
          </TabsTrigger>
          {enrolled && (
            <TabsTrigger value="owner">
              <Home className="h-3.5 w-3.5 mr-1.5" />
              As owner
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="buyer">
          <ViewingList side="buyer" />
        </TabsContent>
        {enrolled && (
          <TabsContent value="owner">
            <ViewingList side="owner" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ViewingList({ side }) {
  const { data, isLoading } = useQuery({
    queryKey: ['viewings', side],
    queryFn: async () => (await api.get('/viewings/mine', { params: { side } })).data.items,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!data?.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {side === 'buyer'
          ? 'No viewings yet — browse listings and request one to get started.'
          : 'No viewings yet. Once buyers request to visit your listings they show up here.'}
      </Card>
    );
  }

  const buckets = bucketize(data);

  return (
    <div className="space-y-6">
      {buckets.pending.length > 0 && (
        <Section title="Awaiting response" items={buckets.pending} side={side} />
      )}
      {buckets.upcoming.length > 0 && (
        <Section title="Upcoming" items={buckets.upcoming} side={side} />
      )}
      {buckets.past.length > 0 && (
        <Section title="Past" items={buckets.past} side={side} />
      )}
    </div>
  );
}

function bucketize(items) {
  const now = Date.now();
  const pending = [];
  const upcoming = [];
  const past = [];
  for (const v of items) {
    if (['requested', 'counter_proposed'].includes(v.status)) {
      pending.push(v);
      continue;
    }
    if (v.status === 'accepted' && new Date(v.startAt).getTime() > now) {
      upcoming.push(v);
      continue;
    }
    past.push(v);
  }
  return { pending, upcoming, past };
}

function Section({ title, items, side }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((v) => (
          <ViewingRow key={v._id} v={v} side={side} />
        ))}
      </ul>
    </section>
  );
}

function ViewingRow({ v, side }) {
  const counterparty = side === 'owner' ? v.buyer?.name : v.owner?.name;
  const listingTitle = v.listing?.title || 'Listing';
  return (
    <li>
      <Link
        to={`/dashboard/viewings/${v._id}`}
        className="flex items-start justify-between gap-3 rounded-xl border border-sectionBorder bg-card p-4 hover:border-primary transition-colors"
      >
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{listingTitle}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatInZone(v.startAt, v.timezone)} · {side === 'owner' ? 'from' : 'with'}{' '}
            {counterparty || 'unknown'}
          </div>
          {v.notes && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.notes}</div>
          )}
        </div>
        <Badge variant={VIEWING_STATUS_VARIANTS[v.status] || 'outline'}>
          {VIEWING_STATUS_LABELS[v.status] || v.status}
        </Badge>
      </Link>
    </li>
  );
}
