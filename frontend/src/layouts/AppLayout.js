import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, Home, MessageSquare, ShieldCheck, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';

const SIDEBAR_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/listings', label: 'My listings', icon: Home },
  { to: '/dashboard/watchlist', label: 'Watchlist', icon: Heart },
  { to: '/dashboard/offers', label: 'Offers', icon: MessageSquare },
  { to: '/dashboard/verification', label: 'Verification (KYC)', icon: ShieldCheck },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-6 py-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {SIDEBAR_LINKS.map(({ to, label, icon: Icon, end }) => (
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
                {label}
              </NavLink>
            ))}
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
