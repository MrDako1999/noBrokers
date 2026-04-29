import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Heart, MessageSquare, Home, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { LISTING_STATUS_LABELS, KYC_STATUS_LABELS } from '@/lib/constants';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const myListings = useQuery({
    queryKey: ['my-listings'],
    queryFn: async () => (await api.get('/listings/mine')).data.items,
  });
  const watchlist = useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => (await api.get('/watchlist')).data.items,
  });
  const sentOffers = useQuery({
    queryKey: ['offers-sent'],
    queryFn: async () => (await api.get('/offers/sent')).data.items,
  });
  const receivedOffers = useQuery({
    queryKey: ['offers-received'],
    queryFn: async () => (await api.get('/offers/received')).data.items,
  });

  const kycStatus = user?.kyc?.status || 'unverified';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      {kycStatus !== 'verified' && (
        <KycBanner status={kycStatus} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Home}
          label="My listings"
          value={myListings.data?.length ?? '—'}
          href="/dashboard/listings"
        />
        <Stat
          icon={Heart}
          label="Watchlist"
          value={watchlist.data?.length ?? '—'}
          href="/dashboard/watchlist"
        />
        <Stat
          icon={MessageSquare}
          label="Offers sent"
          value={sentOffers.data?.length ?? '—'}
          href="/dashboard/offers"
        />
        <Stat
          icon={MessageSquare}
          label="Offers received"
          value={receivedOffers.data?.length ?? '—'}
          href="/dashboard/offers"
        />
      </div>

      <div className="rounded-2xl border border-sectionBorder bg-card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold font-heading">List a property</h2>
            <p className="text-sm text-muted-foreground">
              Free to list. Verified ownership shows up next to your name on every listing.
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/listings/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New listing
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentBlock
          title="Your recent listings"
          empty="You haven't listed any properties yet."
          to="/dashboard/listings"
          items={myListings.data?.slice(0, 4)?.map((l) => ({
            id: l._id,
            href: `/dashboard/listings/${l._id}/edit`,
            title: l.title,
            subtitle: LISTING_STATUS_LABELS[l.status],
            badge: l.status,
          }))}
        />
        <RecentBlock
          title="Recent offers received"
          empty="No offers yet — once your listings are active, offers show up here."
          to="/dashboard/offers"
          items={receivedOffers.data?.slice(0, 4)?.map((o) => ({
            id: o._id,
            href: `/dashboard/offers/${o._id}`,
            title: o.listing?.title,
            subtitle: `Offer: RM ${o.currentAmount?.toLocaleString()}`,
            badge: o.status,
          }))}
        />
      </div>
    </div>
  );
}

// Tone -> static Tailwind classes. We can't interpolate the tone into the
// class string at runtime because Tailwind's JIT only scans literal strings.
const KYC_BANNER_TONES = {
  warning: {
    wrapper: 'border-warning/30 bg-warning-bg',
    iconWrap: 'bg-warning/15 text-warning',
  },
  info: {
    wrapper: 'border-info/30 bg-info-bg',
    iconWrap: 'bg-info/15 text-info',
  },
  destructive: {
    wrapper: 'border-destructive/30 bg-destructive/10',
    iconWrap: 'bg-destructive/15 text-destructive',
  },
};

function KycBanner({ status }) {
  const config = {
    unverified: {
      icon: ShieldAlert,
      tone: 'warning',
      title: 'Complete your KYC verification',
      body: 'Upload a government ID and a selfie so other users see you as a verified party. Verified users get higher offer-acceptance rates.',
      cta: 'Start verification',
    },
    pending: {
      icon: Clock,
      tone: 'info',
      title: 'KYC under review',
      body: 'Our admin team is reviewing your documents. This usually takes under 48 hours.',
      cta: 'View submission',
    },
    rejected: {
      icon: ShieldAlert,
      tone: 'destructive',
      title: 'KYC was not approved',
      body: 'See the reason and resubmit your documents.',
      cta: 'Resubmit',
    },
  }[status] || null;

  if (!config) return null;
  const Icon = config.icon;
  const tone = KYC_BANNER_TONES[config.tone];

  return (
    <div className={`rounded-2xl border ${tone.wrapper} p-5 flex flex-col sm:flex-row gap-4 sm:items-center`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.iconWrap}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{config.title}</div>
        <p className="text-sm opacity-80 mt-0.5">{config.body}</p>
      </div>
      <Button asChild variant="default" size="sm">
        <Link to="/dashboard/verification">{config.cta}</Link>
      </Button>
    </div>
  );
}

function Stat({ icon: Icon, label, value, href }) {
  return (
    <Link
      to={href}
      className="group rounded-2xl border border-sectionBorder bg-card p-5 hover:border-primary transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-heading font-bold">{value}</div>
        </div>
      </div>
    </Link>
  );
}

function RecentBlock({ title, items, empty, to }) {
  return (
    <div className="rounded-2xl border border-sectionBorder bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold font-heading">{title}</h3>
        <Link to={to} className="text-xs text-primary hover:underline">See all</Link>
      </div>
      {!items?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>
      ) : (
        <ul className="divide-y divide-sectionBorder">
          {items.map((it) => (
            <li key={it.id}>
              <Link to={it.href} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{it.subtitle}</div>
                </div>
                {it.badge && (
                  <Badge variant={badgeForStatus(it.badge)}>{LISTING_STATUS_LABELS[it.badge] || it.badge}</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function badgeForStatus(s) {
  if (s === 'active') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'destructive';
  if (s === 'sold' || s === 'rented') return 'info';
  return 'outline';
}
