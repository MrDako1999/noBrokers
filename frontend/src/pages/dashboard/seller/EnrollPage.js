import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';

// Keep this in sync with the seller section of TermsPage.js. Bumping it
// forces every already-enrolled seller to re-accept on their next visit.
const SELLER_TERMS_VERSION = '2026-05-01';

export default function EnrollPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const { syncFromUser } = useModeStore();
  const { toast } = useToast();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const alreadyEnrolled = !!user?.sellerProfile?.enrolled;
  const needsReaccept =
    alreadyEnrolled &&
    user.sellerProfile?.termsAcceptedVersion !== SELLER_TERMS_VERSION;

  const submit = async () => {
    if (!accepted) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/seller/enroll', {
        termsVersion: SELLER_TERMS_VERSION,
      });
      await refreshUser();
      syncFromUser(data.user);
      toast({
        title: 'You are now a lister',
        description: 'Seller tools are available in your dashboard.',
      });
      navigate('/dashboard');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not complete enrollment',
        description: err.response?.data?.error || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
          <Store className="h-3.5 w-3.5" />
          Seller enrollment
        </div>
        <h1 className="mt-3 text-2xl font-heading font-bold tracking-tight">
          {alreadyEnrolled && !needsReaccept
            ? 'You are already enrolled as a lister'
            : 'Become a lister on noBrokers'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Listers post properties, manage viewings, and negotiate with buyers and tenants directly.
          Enrollment is free — listing fees apply per property, outlined in the terms below.
        </p>
      </div>

      {alreadyEnrolled && !needsReaccept ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              All set
            </CardTitle>
            <CardDescription>
              You accepted seller terms on{' '}
              {new Date(user.sellerProfile.termsAcceptedAt).toLocaleDateString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/dashboard/listings/new">Create a listing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard/settings/availability">Set availability</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What you get</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Perk
                title="Post property listings"
                body="Create for-sale or for-rent listings. Every listing is reviewed for ownership proof."
              />
              <Perk
                title="Availability calendar"
                body="Set weekly viewing hours; buyers book within them, you accept or reschedule."
              />
              <Perk
                title="Offer inbox"
                body="Receive, counter, accept or reject offers with a full negotiation trail."
              />
              <Perk
                title="Verified-owner badge"
                body="Once KYC + ownership docs are approved, your listings get the verified badge."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seller terms</CardTitle>
              <CardDescription>
                You are responsible for accurate listing information and for honoring accepted
                viewings and offers. Misrepresentation may lead to account suspension.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc pl-5 text-sm text-foreground/85 space-y-1.5">
                <li>You agree only to list properties you are legally entitled to sell or rent out.</li>
                <li>You will upload ownership documents on every listing so admins can verify.</li>
                <li>You will respond to viewing requests and offers within a reasonable time.</li>
                <li>You consent to KYC verification before your listings are published.</li>
                <li>
                  Review the full{' '}
                  <Link to="/terms" className="text-primary hover:underline">
                    terms of service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-primary hover:underline">
                    privacy policy
                  </Link>
                  .
                </li>
              </ul>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-inputBorderIdle"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I have read and accept the seller terms (version{' '}
                  <code className="text-xs">{SELLER_TERMS_VERSION}</code>).
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  You can revert to buyer-only anytime from your settings.
                </div>
                <Button onClick={submit} disabled={!accepted || submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {needsReaccept ? 'Re-accept & continue' : 'Enroll as lister'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Perk({ title, body }) {
  return (
    <div className="rounded-xl border border-sectionBorder bg-card p-4">
      <div className="font-semibold text-sm">{title}</div>
      <p className="text-xs text-muted-foreground mt-1 leading-snug">{body}</p>
    </div>
  );
}
