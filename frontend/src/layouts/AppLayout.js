import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Heart,
  Home,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  User,
  CalendarClock,
  CalendarDays,
  Clock4,
  Sparkles,
  Search,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';
import useChatStore from '@/stores/chatStore';
import { cn } from '@/lib/utils';

// Buyer/tenant-facing navigation. Viewer-KYC lives here because every user
// is a viewer by default; seller-specific verification would be additional.
const BUYER_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/buy', label: 'Browse', icon: Search },
  { to: '/dashboard/watchlist', label: 'Watchlist', icon: Heart },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 'chatUnread' },
  { to: '/dashboard/offers', label: 'Offers sent', icon: MessageSquare },
  { to: '/dashboard/viewings', label: 'My viewings', icon: CalendarClock },
  { to: '/dashboard/verification', label: 'Verification (KYC)', icon: ShieldCheck },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
];

// Seller-side navigation. Only shown when the user's mode is 'seller' and
// `sellerProfile.enrolled` is true (the switcher enforces the latter).
const SELLER_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/listings', label: 'My listings', icon: Home },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 'chatUnread' },
  { to: '/dashboard/offers', label: 'Offers received', icon: MessageSquare },
  { to: '/dashboard/viewings', label: 'Viewing requests', icon: CalendarClock },
  { to: '/dashboard/seller/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/dashboard/seller/availability', label: 'Availability', icon: Clock4 },
  { to: '/dashboard/verification', label: 'Verification (KYC)', icon: ShieldCheck },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function AppLayout() {
  const { user } = useAuthStore();
  const { mode } = useModeStore();
  const chatUnread = useChatStore((s) => s.totalUnread);

  const enrolled = !!user?.sellerProfile?.enrolled || user?.role === 'admin';
  const effectiveMode = mode === 'seller' && enrolled ? 'seller' : 'buyer';
  const links = effectiveMode === 'seller' ? SELLER_LINKS : BUYER_LINKS;
  const badges = { chatUnread };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-6 py-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start space-y-3">
          <ModeBadge mode={effectiveMode} enrolled={enrolled} />
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {links.map(({ to, label, icon: Icon, end, badge }) => {
              const count = badge ? badges[badge] : 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span className="grid min-w-[20px] h-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
          {!enrolled && effectiveMode === 'buyer' && (
            <Link
              to="/dashboard/seller/enroll"
              className="block rounded-xl border border-dashed border-sectionBorder p-3 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Have a property?
              </div>
              <p className="mt-1 leading-snug">
                Enroll as a lister to post listings and manage viewings.
              </p>
            </Link>
          )}
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

function ModeBadge({ mode, enrolled }) {
  const isSeller = mode === 'seller';
  return (
    <div
      className={cn(
        'hidden md:flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
        isSeller
          ? 'border-primary/30 bg-primary/5 text-primary'
          : 'border-sectionBorder bg-card text-muted-foreground',
      )}
    >
      <span className="font-semibold">
        {isSeller ? 'Seller mode' : 'Buyer mode'}
      </span>
      {!enrolled && !isSeller && (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          viewer
        </span>
      )}
    </div>
  );
}
