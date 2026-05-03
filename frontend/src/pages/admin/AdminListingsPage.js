import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { LISTING_STATUS_LABELS, OWNERSHIP_DOC_LABELS } from '@/lib/constants';
import { formatPrice, formatRent, timeAgo } from '@/lib/format';

export default function AdminListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reviewing, setReviewing] = useState(null);
  const [rejection, setRejection] = useState('');

  const status = searchParams.get('status') || 'pending';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-listings', status],
    queryFn: async () => {
      const params = {};
      if (status && status !== 'all') params.status = status;
      return (await api.get('/admin/listings', { params })).data.items;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, reason }) =>
      (await api.post(`/admin/listings/${id}/verify`, { action, reason })).data.listing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setReviewing(null);
      setRejection('');
      toast({ title: 'Decision saved' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: err.response?.data?.error || 'Try again.',
      });
    },
  });

  const update = (next) => {
    if (!next || next === 'all') setSearchParams({});
    else setSearchParams({ status: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approve listings after reviewing the owner&apos;s ownership documents.
          </p>
        </div>
        <Select value={status} onValueChange={update}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending verification</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-sectionBorder bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="p-10 text-center text-muted-foreground">No listings in this state.</div>
        ) : (
          <ul className="divide-y divide-sectionBorder">
            {data.map((l) => {
              const cover = l.images?.[0]?.url;
              const price = l.listingType === 'sale' ? formatPrice(l.price) : formatRent(l.monthlyRent);
              return (
                <li key={l._id} className="p-4 flex flex-col md:flex-row gap-4">
                  <div className="aspect-[4/3] md:w-44 rounded-xl bg-muted overflow-hidden shrink-0">
                    {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={statusVariant(l.status)}>{LISTING_STATUS_LABELS[l.status]}</Badge>
                      <Badge variant="outline">{l.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Badge>
                    </div>
                    <h3 className="font-medium truncate">{l.title}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[l.location?.city, l.location?.state].filter(Boolean).join(', ')}
                      {' · '}{price}
                      {' · updated '}{timeAgo(l.updatedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Owner: {l.owner?.name} ({l.owner?.email}) — KYC: {l.owner?.kyc?.status || 'unverified'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Documents: {l.verification?.documents?.length || 0} attached
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 md:justify-center">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/listings/${l._id}`}><Eye className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Open</span></Link>
                    </Button>
                    {l.status === 'pending' && (
                      <Button size="sm" onClick={() => setReviewing(l)}>
                        Review
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewing?.title}</DialogTitle>
            <DialogDescription>
              {reviewing?.owner?.name} — {reviewing?.owner?.email}
            </DialogDescription>
          </DialogHeader>

          {reviewing?.verification?.documents?.length ? (
            <ul className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {reviewing.verification.documents.map((d, i) => (
                <li key={d.key || i} className="rounded-xl border border-sectionBorder p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {OWNERSHIP_DOC_LABELS[d.type] || d.type?.replace(/_/g, ' ')}
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">
                      {d.url}
                    </a>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={d.url} target="_blank" rel="noreferrer">Open</a>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Owner did not attach ownership documents.</p>
          )}

          <div>
            <label className="text-[13px] font-medium block mb-1.5">Rejection reason</label>
            <Textarea rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => decide.mutate({ id: reviewing._id, action: 'reject', reason: rejection })}
              disabled={decide.isPending}
            >
              {decide.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <X className="h-4 w-4 mr-1.5" />}
              Reject
            </Button>
            <Button
              onClick={() => decide.mutate({ id: reviewing._id, action: 'approve' })}
              disabled={decide.isPending}
            >
              {decide.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Approve & publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
