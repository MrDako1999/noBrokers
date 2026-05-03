import { NavLink, Outlet } from 'react-router-dom';
import { User, KeyRound, ShieldCheck, Clock4 } from 'lucide-react';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';
import { cn } from '@/lib/utils';

// Sub-tabs for the consolidated Settings area. Availability only renders
// once the user is enrolled as a seller; everyone else gets a 3-tab nav.
const TABS = [
  { to: '/dashboard/settings/profile', label: 'Profile', icon: User },
  { to: '/dashboard/settings/security', label: 'Security', icon: KeyRound },
  { to: '/dashboard/settings/verification', label: 'Verification', icon: ShieldCheck },
  {
    to: '/dashboard/settings/availability',
    label: 'Availability',
    icon: Clock4,
    sellerOnly: true,
  },
];

export default function SettingsLayout() {
  const { user } = useAuthStore();
  const { mode } = useModeStore();
  const enrolled = !!user?.sellerProfile?.enrolled || user?.role === 'admin';
  const showSeller = enrolled && mode === 'seller';
  const tabs = TABS.filter((t) => !t.sellerOnly || showSeller);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Account info, password, identity verification
          {showSeller ? ', and viewing availability.' : '.'}
        </p>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1"
        aria-label="Settings sections"
      >
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
