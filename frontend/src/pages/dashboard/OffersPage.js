import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatPrice, timeAgo } from '@/lib/format';

const STATUS_VARIANT = {
  pending: 'warning',
  countered: 'info',
  accepted: 'success',
  rejected: 'destructive',
  withdrawn: 'outline',
};

export default function OffersPage() {
  const sent = useQuery({
    queryKey: ['offers-sent'],
    queryFn: async () => (await api.get('/offers/sent')).data.items,
  });
  const received = useQuery({
    queryKey: ['offers-received'],
    queryFn: async () => (await api.get('/offers/received')).data.items,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Offers</h1>
        <p className="text-sm text-muted-foreground mt-1">Negotiations on listings you&apos;ve made offers on, and offers received on your listings.</p>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received ({received.data?.length ?? '—'})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sent.data?.length ?? '—'})</TabsTrigger>
        </TabsList>
        <TabsContent value="received">
          <OfferList items={received.data} loading={received.isLoading} side="received" />
        </TabsContent>
        <TabsContent value="sent">
          <OfferList items={sent.data} loading={sent.isLoading} side="sent" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfferList({ items, loading, side }) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {[0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }
  if (!items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-sectionBorder p-10 text-center text-muted-foreground">
        {side === 'sent' ? 'No offers sent yet.' : 'No offers received yet.'}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((o) => {
        const cover = o.listing?.images?.[0]?.url;
        return (
          <li key={o._id}>
            <Link
              to={`/dashboard/offers/${o._id}`}
              className="flex gap-4 rounded-2xl border border-sectionBorder bg-card p-3 hover:border-primary transition-colors"
            >
              <div className="aspect-[4/3] w-32 rounded-lg bg-muted overflow-hidden shrink-0">
                {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                  <Badge variant="outline">{o.type === 'purchase' ? 'Purchase' : 'Rent'}</Badge>
                </div>
                <h3 className="font-medium truncate">{o.listing?.title || 'Listing removed'}</h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {side === 'sent'
                    ? `To ${o.owner?.name || '—'}`
                    : `From ${o.buyer?.name || '—'}`}
                  {' · '}{timeAgo(o.lastActivityAt)}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-semibold">{formatPrice(o.currentAmount)}</span>
                  <span className="text-muted-foreground"> / asking {formatPrice(o.listingAskingPrice)}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
