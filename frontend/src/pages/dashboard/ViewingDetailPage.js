import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  CalendarClock,
  CalendarX2,
  Loader2,
  Shuffle,
  Download,
  Ban,
  UserCheck,
  UserX,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import SlotPicker from '@/components/SlotPicker';
import { VIEWING_STATUS_LABELS, VIEWING_STATUS_VARIANTS } from '@/lib/constants';
import { formatInZone } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ViewingDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [proposeOpen, setProposeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['viewing', id],
    queryFn: async () => (await api.get(`/viewings/${id}`)).data.viewing,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['viewing', id] });
    queryClient.invalidateQueries({ queryKey: ['viewings'] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ path, payload }) => (await api.post(`/viewings/${id}${path}`, payload || {})).data,
    onSuccess: () => invalidate(),
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  const runAction = (path, payload) => actionMutation.mutate({ path, payload });

  const downloadIcs = async () => {
    try {
      const res = await api.get(`/viewings/${id}/ics`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viewing-${id}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not download calendar file',
        description: err.response?.data?.error || 'Please try again.',
      });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Viewing not found.</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/viewings">Back to viewings</Link>
        </Button>
      </div>
    );
  }

  const viewing = data;
  const role =
    String(viewing.owner._id) === String(user?._id)
      ? 'owner'
      : String(viewing.buyer._id) === String(user?._id)
      ? 'buyer'
      : null;

  const isTerminal = ['declined', 'cancelled', 'completed', 'no_show', 'expired'].includes(
    viewing.status,
  );
  const counterparty = role === 'owner' ? viewing.buyer : viewing.owner;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/dashboard/viewings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All viewings
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {viewing.mode === 'virtual' ? 'Virtual tour' : 'In-person viewing'}
          </div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            {viewing.listing?.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {[viewing.listing?.location?.city, viewing.listing?.location?.state]
              .filter(Boolean)
              .join(', ') || 'Location hidden until accepted'}
          </p>
        </div>
        <Badge variant={VIEWING_STATUS_VARIANTS[viewing.status] || 'outline'} className="self-start">
          {VIEWING_STATUS_LABELS[viewing.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {viewing.status === 'accepted' ? 'Confirmed for' : 'Proposed for'}
          </CardTitle>
          <CardDescription>{formatInZone(viewing.startAt, viewing.timezone)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Field label={role === 'owner' ? 'Buyer' : 'Owner'} value={counterparty?.name} />
          <Field label="Timezone" value={viewing.timezone} />
          {viewing.status === 'accepted' && (
            <Field
              label="Contact"
              value={counterparty?.phone || counterparty?.email || '—'}
            />
          )}
          <Field label="Mode" value={viewing.mode === 'virtual' ? 'Virtual tour' : 'In person'} />
        </CardContent>
      </Card>

      {!!viewing.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-foreground/85">
            {viewing.notes}
          </CardContent>
        </Card>
      )}

      {/* Action bar — role + status aware. Reacts to the state machine
          defined in backend/src/services/viewings.js. */}
      {!isTerminal && role && (
        <div className="flex flex-wrap gap-2">
          {role === 'owner' && viewing.status === 'requested' && (
            <>
              <Button onClick={() => runAction('/accept')} disabled={actionMutation.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Accept this time
              </Button>
              <Button variant="outline" onClick={() => setProposeOpen(true)}>
                <Shuffle className="h-4 w-4 mr-1.5" />
                Propose another time
              </Button>
              <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                <UserX className="h-4 w-4 mr-1.5" />
                Decline
              </Button>
            </>
          )}

          {/* Counter-proposed state: only the *other* party can accept the
              latest proposal. Everyone can still propose again or decline. */}
          {viewing.status === 'counter_proposed' && (() => {
            const last = viewing.proposals?.[viewing.proposals.length - 1];
            const canAcceptLast = last && last.role !== role;
            return (
              <>
                {canAcceptLast && (
                  <Button
                    onClick={() => runAction(`/accept-proposal/${last._id}`)}
                    disabled={actionMutation.isPending}
                  >
                    <UserCheck className="h-4 w-4 mr-1.5" />
                    Accept {last.role === 'owner' ? 'owner' : 'buyer'}&apos;s time
                  </Button>
                )}
                <Button variant="outline" onClick={() => setProposeOpen(true)}>
                  <Shuffle className="h-4 w-4 mr-1.5" />
                  Propose different time
                </Button>
                {role === 'owner' && (
                  <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                    <UserX className="h-4 w-4 mr-1.5" />
                    Decline
                  </Button>
                )}
              </>
            );
          })()}

          {/* Buyer on a fresh request can only withdraw or propose a new time. */}
          {role === 'buyer' && viewing.status === 'requested' && (
            <Button variant="outline" onClick={() => setProposeOpen(true)}>
              <Shuffle className="h-4 w-4 mr-1.5" />
              Propose different time
            </Button>
          )}

          {viewing.status === 'accepted' && (
            <>
              <Button variant="outline" onClick={downloadIcs}>
                <Download className="h-4 w-4 mr-1.5" />
                Add to calendar
              </Button>
              {role === 'owner' && (
                <>
                  <Button variant="outline" onClick={() => runAction('/complete')}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Mark completed
                  </Button>
                  <Button variant="outline" onClick={() => runAction('/no-show')}>
                    <CalendarX2 className="h-4 w-4 mr-1.5" />
                    No-show
                  </Button>
                </>
              )}
            </>
          )}

          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            <Ban className="h-4 w-4 mr-1.5" />
            {viewing.status === 'accepted' ? 'Cancel' : 'Withdraw'}
          </Button>
        </div>
      )}

      <Timeline viewing={viewing} currentUserId={user?._id} />

      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <ProposeDialog
          listingId={viewing.listing._id}
          submitting={actionMutation.isPending}
          onSubmit={(payload) => {
            setProposeOpen(false);
            runAction('/propose', payload);
          }}
        />
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <ReasonDialog
          title="Decline request?"
          description="The buyer will see this viewing as declined. You can add a short note."
          submitLabel="Decline"
          submitting={actionMutation.isPending}
          onSubmit={(reason) => {
            setDeclineOpen(false);
            runAction('/decline', { reason });
          }}
        />
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <ReasonDialog
          title={viewing.status === 'accepted' ? 'Cancel viewing?' : 'Withdraw request?'}
          description="This cannot be undone — you can always request a new one."
          submitLabel={viewing.status === 'accepted' ? 'Cancel viewing' : 'Withdraw'}
          submitting={actionMutation.isPending}
          destructive
          onSubmit={(reason) => {
            setCancelOpen(false);
            runAction('/cancel', { reason });
          }}
        />
      </Dialog>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  );
}

// Append-only timeline — initial request + every proposal + terminal state.
function Timeline({ viewing, currentUserId }) {
  const events = [
    {
      key: 'created',
      at: viewing.createdAt,
      by: viewing.buyer?.name,
      role: 'buyer',
      kind: 'request',
      startAt: viewing.proposals?.[0]?.startAt || viewing.startAt,
      endAt: viewing.proposals?.[0]?.endAt || viewing.endAt,
      message: viewing.notes,
    },
    ...(viewing.proposals || []).map((p) => ({
      key: p._id,
      at: p.createdAt,
      by: p.by?.name,
      role: p.role,
      kind: 'proposal',
      startAt: p.startAt,
      endAt: p.endAt,
      message: p.message,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
        <CardDescription>
          Every proposal and status change is recorded for both parties to review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {events.map((ev) => (
            <li key={ev.key} className="flex gap-3">
              <div
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  ev.role === 'owner' ? 'bg-primary' : 'bg-info',
                )}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {ev.kind === 'request' ? 'Request sent' : 'Counter proposed'} by {ev.by || 'someone'}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({ev.role})
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatInZone(ev.startAt, viewing.timezone)} — {new Date(ev.at).toLocaleString()}
                </div>
                {ev.message && (
                  <div className="text-sm mt-1 whitespace-pre-line">{ev.message}</div>
                )}
              </div>
            </li>
          ))}
          {viewing.status !== 'requested' && viewing.status !== 'counter_proposed' && (
            <li className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Status: {VIEWING_STATUS_LABELS[viewing.status]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(viewing.lastActivityAt || viewing.updatedAt).toLocaleString()}
                </div>
              </div>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}

function ProposeDialog({ listingId, submitting, onSubmit }) {
  const [slot, setSlot] = useState(null);
  const [message, setMessage] = useState('');

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Propose a different time</DialogTitle>
        <DialogDescription>
          Pick a slot from the owner&apos;s availability; the other party will see it and can accept.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <SlotPicker listingId={listingId} selected={slot} onSelect={setSlot} />
        <div className="space-y-1.5">
          <Label htmlFor="propMsg">Message (optional)</Label>
          <Textarea
            id="propMsg"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!slot || submitting}
          onClick={() =>
            onSubmit({
              startAt: slot.startAt,
              endAt: slot.endAt,
              message,
            })
          }
        >
          {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Send proposal
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReasonDialog({ title, description, submitLabel, submitting, onSubmit, destructive }) {
  const [reason, setReason] = useState('');
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          onClick={() => onSubmit(reason)}
          disabled={submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
