import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import FileUploader from '@/components/FileUploader';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { KYC_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

const KYC_DOC_TYPES = [
  { value: 'ic_front', label: 'IC (front)' },
  { value: 'ic_back', label: 'IC (back)' },
  { value: 'passport', label: 'Passport' },
  { value: 'utility', label: 'Utility bill' },
  { value: 'selfie', label: 'Selfie holding IC' },
  { value: 'other', label: 'Other' },
];

export default function VerificationTab() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuthStore();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);

  const { data } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: async () => (await api.get('/users/kyc/status')).data,
    initialData: {
      status: user?.kyc?.status || 'unverified',
      submittedAt: user?.kyc?.submittedAt,
      verifiedAt: user?.kyc?.verifiedAt,
      rejectionReason: user?.kyc?.rejectionReason,
      documents: user?.kyc?.documents || [],
    },
  });

  const submit = useMutation({
    mutationFn: async () => (await api.post('/users/kyc', { documents: docs })).data.user,
    onSuccess: async () => {
      setDocs([]);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
      toast({ title: 'Submitted for review', description: 'You will get an email once a decision is made.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not submit',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  const status = data.status;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Verified users have a green badge on every listing they post and offer they make.
        We&apos;ll integrate MyDigitalID later — for now an admin reviews submissions manually.
      </p>

      <StatusCard status={status} data={data} />

      {(status === 'unverified' || status === 'rejected') && (
        <div className="rounded-2xl border border-sectionBorder bg-card p-5 space-y-4">
          <div>
            <h2 className="font-heading font-semibold">Upload documents</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              We need a government ID (IC or passport) and ideally a selfie holding your ID. PDFs and images both work.
            </p>
          </div>
          <FileUploader
            value={docs}
            onChange={setDocs}
            kind="kyc-doc"
            variant="document-list"
            types={KYC_DOC_TYPES}
            maxFiles={6}
            emptyLabel="Add KYC documents"
            helperText="You can upload multiple files at once. Drag & drop or click to browse."
          />
          <div className="flex justify-end">
            <Button disabled={!docs.length || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Submit for review
            </Button>
          </div>
        </div>
      )}

      {data.documents?.length > 0 && (
        <div className="rounded-2xl border border-sectionBorder bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">Submitted documents</h3>
          <ul className="divide-y divide-sectionBorder">
            {data.documents.map((d, i) => (
              <li key={d.key || i} className="flex items-center justify-between py-2 text-sm">
                <a href={d.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {(d.key?.split('/').pop()) || 'document'}
                </a>
                <Badge variant="outline">{KYC_DOC_TYPES.find((t) => t.value === d.type)?.label || d.type}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Static Tailwind class lookup — see comment in DashboardPage.js.
const STATUS_TONES = {
  success: { wrapper: 'border-success/30 bg-success-bg', iconWrap: 'bg-success/15 text-success' },
  warning: { wrapper: 'border-warning/30 bg-warning-bg', iconWrap: 'bg-warning/15 text-warning' },
  info: { wrapper: 'border-info/30 bg-info-bg', iconWrap: 'bg-info/15 text-info' },
  destructive: {
    wrapper: 'border-destructive/30 bg-destructive/10',
    iconWrap: 'bg-destructive/15 text-destructive',
  },
};

function StatusCard({ status, data }) {
  const config = {
    verified: { Icon: ShieldCheck, tone: 'success', title: 'You are verified' },
    pending: { Icon: Clock, tone: 'warning', title: 'Under review' },
    rejected: { Icon: ShieldAlert, tone: 'destructive', title: 'Submission rejected' },
    unverified: { Icon: ShieldAlert, tone: 'info', title: 'Not yet verified' },
  }[status];

  const { Icon, tone, title } = config;
  const toneClasses = STATUS_TONES[tone];

  return (
    <div className={`rounded-2xl border ${toneClasses.wrapper} p-5`}>
      <div className="flex items-start gap-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClasses.iconWrap}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-heading font-semibold">{title}</div>
          <div className="text-sm opacity-90 mt-0.5">{KYC_STATUS_LABELS[status]}</div>
          {status === 'pending' && data.submittedAt && (
            <div className="text-xs opacity-70 mt-1">Submitted {formatDate(data.submittedAt)}</div>
          )}
          {status === 'verified' && data.verifiedAt && (
            <div className="text-xs opacity-70 mt-1">Verified {formatDate(data.verifiedAt)}</div>
          )}
          {status === 'rejected' && data.rejectionReason && (
            <div className="text-xs opacity-90 mt-1">Reason: {data.rejectionReason}</div>
          )}
        </div>
      </div>
    </div>
  );
}
