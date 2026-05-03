import { Link } from 'react-router-dom';
import { Eye, Store, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';

// Single, dedicated control for switching between buyer and seller dashboards.
// Lives at the top of the dashboard sidebar — not in the global navbar —
// because the distinction only matters once you're inside the app.
//
// Two render states:
//   - Enrolled user: segmented buyer/seller toggle (full-width in sidebar).
//   - Not-enrolled user: "Become a lister" enrollment CTA in the same slot,
//     so the region is always the "who am I right now" block.
export default function ModeSwitcher({ className }) {
  const { user } = useAuthStore();
  const { mode, setMode } = useModeStore();

  if (!user) return null;

  const enrolled = !!user.sellerProfile?.enrolled || user.role === 'admin';

  if (!enrolled) {
    return (
      <Link
        to="/dashboard/seller/enroll"
        className={cn(
          'group block rounded-xl border border-dashed border-sectionBorder p-3 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors',
          className,
        )}
      >
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Have a property?
        </div>
        <p className="mt-1 leading-snug">
          Enroll as a lister to post listings and manage viewings.
        </p>
      </Link>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Switch dashboard mode"
      className={cn(
        'flex items-center rounded-full border border-sectionBorder bg-card p-0.5 text-xs font-medium',
        className,
      )}
    >
      <PillTab
        active={mode === 'buyer'}
        onClick={() => setMode('buyer', { user })}
        icon={Eye}
        label="Buyer"
      />
      <PillTab
        active={mode === 'seller'}
        onClick={() => setMode('seller', { user })}
        icon={Store}
        label="Seller"
      />
    </div>
  );
}

function PillTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
        active
          ? 'bg-primary text-white shadow-sm'
          : 'text-foreground/70 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
