import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Heart,
  Home,
  MessageSquare,
  MessageCircle,
  Settings,
  CalendarClock,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ModeSwitcher from '@/components/ModeSwitcher';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';
import useChatStore from '@/stores/chatStore';
import { cn } from '@/lib/utils';

// Buyer/tenant-facing navigation. Profile, password, and KYC live behind
// the unified Settings entry — every user gets the same Settings hub.
const BUYER_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/watchlist', label: 'Watchlist', icon: Heart },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 'chatUnread' },
  { to: '/dashboard/offers', label: 'Offers sent', icon: MessageSquare },
  { to: '/dashboard/viewings', label: 'My viewings', icon: CalendarClock },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Seller-side navigation. Only shown when the user's mode is 'seller' and
// `sellerProfile.enrolled` is true (the switcher enforces the latter).
// Availability is a sub-tab inside Settings rather than a top-level link.
const SELLER_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/listings', label: 'My listings', icon: Home },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 'chatUnread' },
  { to: '/dashboard/offers', label: 'Offers received', icon: MessageSquare },
  { to: '/dashboard/viewings', label: 'Viewing requests', icon: CalendarClock },
  { to: '/dashboard/seller/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
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
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="hidden md:inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Open admin console
            </Link>
          )}
          <ModeSwitcher className="hidden md:flex" />
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
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

