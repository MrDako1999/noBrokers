import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { formatPrice, timeAgo } from '@/lib/format';

export default function OfferDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [counterAmount, setCounterAmount] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['offer', id],
    queryFn: async () => (await api.get(`/offers/${id}`)).data.offer,
  });

  const respondMutation = useMutation({
    mutationFn: async (body) => (await api.post(`/offers/${id}/respond`, body)).data.offer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer', id] });
      queryClient.invalidateQueries({ queryKey: ['offers-sent'] });
      queryClient.invalidateQueries({ queryKey: ['offers-received'] });
      setCounterAmount('');
      setMessage('');
      toast({ title: 'Response sent' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not send response',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  if (isLoading || !data) {
    return <div className="h-[400px] rounded-2xl bg-muted animate-pulse" />;
  }

  const isBuyer = data.buyer?._id === user?._id;
  const isOwner = data.owner?._id === user?._id;
  const myRole = isBuyer ? 'buyer' : 'owner';
  const isClosed = ['accepted', 'rejected', 'withdrawn'].includes(data.status);
  const lastTurn = data.negotiations[data.negotiations.length - 1];
  const otherSideTurn = lastTurn?.actorRole !== myRole;

  return (
    <div className="space-y-6">
      <Link to="/dashboard/offers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to offers
      </Link>

      <div className="rounded-2xl border border-sectionBorder bg-card p-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex gap-4 min-w-0">
            <div className="aspect-[4/3] w-32 rounded-lg bg-muted overflow-hidden shrink-0">
              {data.listing?.images?.[0]?.url && (
                <img src={data.listing.images[0].url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariant(data.status)}>{data.status}</Badge>
                <Badge variant="outline">{data.type === 'purchase' ? 'Purchase' : 'Rent'}</Badge>
              </div>
              <h1 className="mt-1 font-heading text-xl font-bold tracking-tight truncate">
                <Link to={`/listings/${data.listing._id}`} className="hover:text-primary">
                  {data.listing?.title}
                </Link>
              </h1>
              <p className="text-sm text-muted-foreground">
                {isBuyer ? `Owner: ${data.owner?.name}` : `Buyer: ${data.buyer?.name}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current offer</div>
            <div className="text-2xl font-heading font-bold">{formatPrice(data.currentAmount)}</div>
            <div className="text-xs text-muted-foreground">
              Asking {formatPrice(data.listingAskingPrice)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sectionBorder bg-card p-5">
        <h2 className="font-heading font-semibold mb-4">Conversation</h2>
        <ul className="space-y-3">
          {data.negotiations.map((n) => {
            const mine = n.from?._id === user?._id;
            return (
              <li key={n._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? 'bg-primary text-white' : 'bg-secondary text-secondary-foreground'
                }`}>
                  <div className="font-semibold">{formatPrice(n.amount)}</div>
                  {n.message && <div className="opacity-90 mt-0.5 whitespace-pre-line">{n.message}</div>}
                  <div className="text-[10px] opacity-70 mt-1">
                    {n.from?.name} · {timeAgo(n.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!isClosed && (
        <div className="rounded-2xl border border-sectionBorder bg-card p-5 space-y-4">
          <h2 className="font-heading font-semibold">Respond</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="counter">Counter amount (RM)</Label>
              <Input
                id="counter"
                type="number"
                min="0"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg">Message (optional)</Label>
              <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {otherSideTurn && (
              <Button
                onClick={() => respondMutation.mutate({ action: 'accept', message })}
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Accept {formatPrice(data.currentAmount)}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => respondMutation.mutate({ action: 'counter', amount: Number(counterAmount), message })}
              disabled={!counterAmount || respondMutation.isPending}
            >
              Counter at {counterAmount ? formatPrice(Number(counterAmount)) : '—'}
            </Button>
            <Button
              variant="outline"
              onClick={() => respondMutation.mutate({ action: 'reject', message })}
              disabled={respondMutation.isPending}
            >
              Reject
            </Button>
            {isBuyer && (
              <Button
                variant="ghost"
                onClick={() => respondMutation.mutate({ action: 'withdraw', message })}
                disabled={respondMutation.isPending}
              >
                Withdraw
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function statusVariant(s) {
  if (s === 'accepted') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'countered') return 'info';
  if (s === 'rejected') return 'destructive';
  return 'outline';
}
