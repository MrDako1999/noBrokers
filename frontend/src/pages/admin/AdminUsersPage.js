import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { KYC_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reviewing, setReviewing] = useState(null);
  const [rejection, setRejection] = useState('');

  const status = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', status, search],
    queryFn: async () => {
      const params = {};
      if (status && status !== 'all') params.status = status;
      if (search) params.search = search;
      return (await api.get('/admin/users', { params })).data.items;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, reason }) =>
      (await api.post(`/admin/users/${id}/kyc`, { action, reason })).data.user,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  const update = (patch) => {
    const next = { status, search, ...patch };
    Object.keys(next).forEach((k) => {
      if (!next[k] || next[k] === 'all') delete next[k];
    });
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Users & KYC</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review identity submissions. Approving sets the user&apos;s KYC status to verified.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by name or email"
            defaultValue={search}
            onKeyDown={(e) => e.key === 'Enter' && update({ search: e.target.value })}
          />
        </div>
        <Select value={status} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="unverified">Not submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-sectionBorder bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="p-10 text-center text-muted-foreground">No users match the filters.</div>
        ) : (
          <ul className="divide-y divide-sectionBorder">
            {data.map((u) => (
              <li key={u._id} className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.name}</span>
                    <Badge variant={kycVariant(u.kyc?.status)}>
                      {KYC_STATUS_LABELS[u.kyc?.status || 'unverified']}
                    </Badge>
                    {u.role === 'admin' && <Badge variant="default">Admin</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.email} · joined {formatDate(u.createdAt)}
                    {u.kyc?.submittedAt && ` · submitted ${formatDate(u.kyc.submittedAt)}`}
                  </div>
                  {u.kyc?.rejectionReason && (
                    <div className="text-xs text-destructive mt-1">
                      Rejection note: {u.kyc.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setReviewing(u)}>
                    Review docs
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewing?.name}&apos;s submission</DialogTitle>
            <DialogDescription>
              {reviewing?.email}{' '}
              {reviewing?.kyc?.submittedAt && `· submitted ${formatDate(reviewing.kyc.submittedAt)}`}
            </DialogDescription>
          </DialogHeader>

          {reviewing?.kyc?.documents?.length ? (
            <ul className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {reviewing.kyc.documents.map((d, i) => (
                <li key={d.key || i} className="rounded-xl border border-sectionBorder p-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{d.type}</div>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-primary truncate hover:underline">
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
            <p className="text-sm text-muted-foreground">No documents on file.</p>
          )}

          <div>
            <label className="text-[13px] font-medium block mb-1.5">Rejection reason (only used when rejecting)</label>
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
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function kycVariant(s) {
  if (s === 'verified') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'destructive';
  return 'outline';
}
