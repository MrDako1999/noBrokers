import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { LISTING_STATUS_LABELS } from '@/lib/constants';
import { formatPrice, formatRent, timeAgo } from '@/lib/format';

export default function MyListingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: async () => (await api.get('/listings/mine')).data.items,
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => api.delete(`/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      toast({ title: 'Listing archived' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">My listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All your properties — drafts, pending, active, sold or rented.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/listings/new"><Plus className="h-4 w-4 mr-1.5" />New listing</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-sectionBorder p-10 text-center text-muted-foreground">
          You haven&apos;t listed any property yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((l) => {
            const cover = l.images?.[0]?.url;
            const price = l.listingType === 'sale' ? formatPrice(l.price) : formatRent(l.monthlyRent);
            return (
              <li key={l._id} className="rounded-2xl border border-sectionBorder bg-card p-4 flex flex-col sm:flex-row gap-4">
                <div className="aspect-[4/3] sm:w-44 rounded-xl bg-muted overflow-hidden shrink-0">
                  {cover && <img src={cover} alt={l.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={statusVariant(l.status)}>{LISTING_STATUS_LABELS[l.status]}</Badge>
                    <Badge variant="outline">{l.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Badge>
                  </div>
                  <h3 className="font-medium line-clamp-1">{l.title}</h3>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {[l.location?.city, l.location?.state].filter(Boolean).join(', ')}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="font-semibold">{price}</span>
                    <span className="text-muted-foreground text-xs">Updated {timeAgo(l.updatedAt)}</span>
                    {l.views ? <span className="text-muted-foreground text-xs">{l.views} views</span> : null}
                  </div>

                  {l.status === 'rejected' && l.verification?.rejectionReason && (
                    <div className="mt-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
                      Rejected: {l.verification.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="flex sm:flex-col gap-2 sm:justify-center">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/listings/${l._id}`}><Eye className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">View</span></Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/dashboard/listings/${l._id}/edit`}><Pencil className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Edit</span></Link>
                  </Button>
                  {l.status !== 'archived' && (
                    <Button variant="outline" size="sm" onClick={() => archiveMutation.mutate(l._id)}>
                      <Archive className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Archive</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function statusVariant(s) {
  if (s === 'active') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'destructive';
  if (s === 'sold' || s === 'rented') return 'info';
  return 'outline';
}
