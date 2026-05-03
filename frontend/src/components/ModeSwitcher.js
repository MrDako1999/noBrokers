import { Link } from 'react-router-dom';
import { Eye, Store, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/authStore';
import useModeStore from '@/stores/modeStore';

// Pill toggle rendered in the navbar. Three states:
//  1. Signed-out or not-enrolled   -> "Become a lister" CTA link
//  2. Enrolled                     -> segmented buyer/seller pill
//  3. Admin                        -> treated like enrolled (can always toggle)
export default function ModeSwitcher({ className }) {
  const { user } = useAuthStore();
  const { mode, setMode } = useModeStore();

  if (!user) return null;

  const enrolled = !!user.sellerProfile?.enrolled || user.role === 'admin';

  if (!enrolled) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn('hidden md:inline-flex', className)}
      >
        <Link to="/dashboard/seller/enroll">
          <Sparkles className="h-4 w-4 mr-1.5" />
          Become a lister
        </Link>
      </Button>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Switch dashboard mode"
      className={cn(
        'hidden md:inline-flex items-center rounded-full border border-sectionBorder bg-card p-0.5 text-xs font-medium',
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
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
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
