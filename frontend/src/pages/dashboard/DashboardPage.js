import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Heart,
  MessageSquare,
  MessageCircle,
  Home,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CalendarClock,
  Sparkles,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';
import useChatStore from '@/stores/chatStore';
import {
  LISTING_STATUS_LABELS,
  VIEWING_STATUS_LABELS,
  VIEWING_STATUS_VARIANTS,
} from '@/lib/constants';
import { formatInZone } from '@/lib/format';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { mode } = useModeStore();
  const chatConversations = useChatStore((s) => s.conversations);
  const chatUnread = useChatStore((s) => s.totalUnread);

  const enrolled = !!user?.sellerProfile?.enrolled || user?.role === 'admin';
  const effectiveMode = mode === 'seller' && enrolled ? 'seller' : 'buyer';

  const myListings = useQuery({
    queryKey: ['my-listings'],
    queryFn: async () => (await api.get('/listings/mine')).data.items,
    enabled: enrolled,
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
    enabled: enrolled,
  });
  const buyerViewings = useQuery({
    queryKey: ['viewings', 'buyer'],
    queryFn: async () =>
      (await api.get('/viewings/mine', { params: { side: 'buyer' } })).data.items,
  });
  const ownerViewings = useQuery({
    queryKey: ['viewings', 'owner'],
    queryFn: async () =>
      (await api.get('/viewings/mine', { params: { side: 'owner' } })).data.items,
    enabled: enrolled,
  });

  const kycStatus = user?.kyc?.status || 'unverified';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {effectiveMode === 'seller'
              ? 'Manage your listings, viewings and offers.'
              : 'Browse, save, and book viewings on properties you like.'}
          </p>
        </div>
        <Badge variant={effectiveMode === 'seller' ? 'default' : 'secondary'}>
          {effectiveMode === 'seller' ? 'Seller mode' : 'Buyer mode'}
        </Badge>
      </div>

      {kycStatus !== 'verified' && <KycBanner status={kycStatus} />}

      {!enrolled && <SellerEnrollmentBanner />}

      {effectiveMode === 'seller' ? (
        <SellerOverview
          myListings={myListings.data}
          receivedOffers={receivedOffers.data}
          ownerViewings={ownerViewings.data}
          chatCount={chatConversations.length}
          chatUnread={chatUnread}
        />
      ) : (
        <BuyerOverview
          watchlist={watchlist.data}
          sentOffers={sentOffers.data}
          buyerViewings={buyerViewings.data}
          chatCount={chatConversations.length}
          chatUnread={chatUnread}
        />
      )}
    </div>
  );
}

function BuyerOverview({ watchlist, sentOffers, buyerViewings, chatCount, chatUnread }) {
  const upcoming = (buyerViewings || []).filter(
    (v) => ['requested', 'counter_proposed', 'accepted'].includes(v.status),
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Heart} label="Watchlist" value={watchlist?.length ?? '—'} href="/dashboard/watchlist" />
        <Stat
          icon={MessageCircle}
          label="Messages"
          value={chatCount}
          href="/dashboard/messages"
          badge={chatUnread}
        />
        <Stat
          icon={MessageSquare}
          label="Offers sent"
          value={sentOffers?.length ?? '—'}
          href="/dashboard/offers"
        />
        <Stat
          icon={CalendarClock}
          label="Viewings booked"
          value={upcoming.length}
          href="/dashboard/viewings"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ViewingsBlock
          title="Your upcoming viewings"
          items={upcoming.slice(0, 4)}
          empty="You have not booked any viewings yet."
          side="buyer"
        />
        <RecentOffersBlock title="Recent offers" items={sentOffers?.slice(0, 4)} />
      </div>
    </>
  );
}

function SellerOverview({ myListings, receivedOffers, ownerViewings, chatCount, chatUnread }) {
  const pendingRequests = (ownerViewings || []).filter((v) =>
    ['requested', 'counter_proposed'].includes(v.status),
  );
  const upcoming = (ownerViewings || []).filter(
    (v) => v.status === 'accepted' && new Date(v.startAt) > new Date(),
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Home}
          label="My listings"
          value={myListings?.length ?? '—'}
          href="/dashboard/listings"
        />
        <Stat
          icon={MessageCircle}
          label="Messages"
          value={chatCount}
          href="/dashboard/messages"
          badge={chatUnread}
        />
        <Stat
          icon={MessageSquare}
          label="Offers received"
          value={receivedOffers?.length ?? '—'}
          href="/dashboard/offers"
        />
        <Stat
          icon={CalendarClock}
          label="Viewing requests"
          value={pendingRequests.length}
          href="/dashboard/viewings"
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/settings/availability">Set availability</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/listings/new">
                <Plus className="h-4 w-4 mr-1.5" />
                New listing
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ViewingsBlock
          title="Pending viewing requests"
          items={pendingRequests.slice(0, 4)}
          empty="No pending requests. Buyers will book from your availability."
          side="owner"
        />
        <RecentListingsBlock items={myListings?.slice(0, 4)} />
      </div>
    </>
  );
}

function SellerEnrollmentBanner() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Store className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Have a property to list?
        </div>
        <p className="text-sm opacity-85 mt-0.5">
          Enroll as a lister in 30 seconds to post properties, set viewing hours, and handle
          offers — all direct with buyers.
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard/seller/enroll">Become a lister</Link>
      </Button>
    </div>
  );
}

const KYC_BANNER_TONES = {
  warning: { wrapper: 'border-warning/30 bg-warning-bg', iconWrap: 'bg-warning/15 text-warning' },
  info: { wrapper: 'border-info/30 bg-info-bg', iconWrap: 'bg-info/15 text-info' },
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
        <Link to="/dashboard/settings/verification">{config.cta}</Link>
      </Button>
    </div>
  );
}

function Stat({ icon: Icon, label, value, href, badge }) {
  return (
    <Link
      to={href}
      className="group relative rounded-2xl border border-sectionBorder bg-card p-5 hover:border-primary transition-colors"
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
      {badge > 0 && (
        <span className="absolute right-3 top-3 grid min-w-[22px] h-[22px] place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function ViewingsBlock({ title, items, empty, side }) {
  return (
    <div className="rounded-2xl border border-sectionBorder bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold font-heading">{title}</h3>
        <Link to="/dashboard/viewings" className="text-xs text-primary hover:underline">
          See all
        </Link>
      </div>
      {!items?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>
      ) : (
        <ul className="divide-y divide-sectionBorder">
          {items.map((v) => (
            <li key={v._id}>
              <Link
                to={`/dashboard/viewings/${v._id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-primary"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {v.listing?.title || 'Listing'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatInZone(v.startAt, v.timezone)}{' '}
                    {side === 'owner' ? `· ${v.buyer?.name || ''}` : ''}
                  </div>
                </div>
                <Badge variant={VIEWING_STATUS_VARIANTS[v.status] || 'outline'}>
                  {VIEWING_STATUS_LABELS[v.status] || v.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentListingsBlock({ items }) {
  return (
    <div className="rounded-2xl border border-sectionBorder bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold font-heading">Your recent listings</h3>
        <Link to="/dashboard/listings" className="text-xs text-primary hover:underline">
          See all
        </Link>
      </div>
      {!items?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          You haven&apos;t listed any properties yet.
        </p>
      ) : (
        <ul className="divide-y divide-sectionBorder">
          {items.map((l) => (
            <li key={l._id}>
              <Link
                to={`/dashboard/listings/${l._id}/edit`}
                className="flex items-center justify-between gap-3 py-3 hover:text-primary"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{l.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {LISTING_STATUS_LABELS[l.status]}
                  </div>
                </div>
                <Badge variant={badgeForStatus(l.status)}>
                  {LISTING_STATUS_LABELS[l.status] || l.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentOffersBlock({ title, items }) {
  return (
    <div className="rounded-2xl border border-sectionBorder bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold font-heading">{title}</h3>
        <Link to="/dashboard/offers" className="text-xs text-primary hover:underline">
          See all
        </Link>
      </div>
      {!items?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No offers yet.</p>
      ) : (
        <ul className="divide-y divide-sectionBorder">
          {items.map((o) => (
            <li key={o._id}>
              <Link
                to={`/dashboard/offers/${o._id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-primary"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{o.listing?.title}</div>
                  <div className="text-xs text-muted-foreground">
                    RM {o.currentAmount?.toLocaleString()}
                  </div>
                </div>
                <Badge variant={badgeForStatus(o.status)}>{o.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function badgeForStatus(s) {
  if (s === 'active' || s === 'accepted') return 'success';
  if (s === 'pending' || s === 'requested') return 'warning';
  if (s === 'rejected' || s === 'declined') return 'destructive';
  if (s === 'sold' || s === 'rented' || s === 'countered' || s === 'counter_proposed') return 'info';
  return 'outline';
}
