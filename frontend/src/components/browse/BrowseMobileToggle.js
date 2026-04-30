import { Map as MapIcon, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Floating mobile toggle to flip between the list and map viewports.
// Hidden on md+ where both columns are visible side-by-side.
export default function BrowseMobileToggle({ view, onChange }) {
  const next = view === 'map' ? 'list' : 'map';
  const Icon = view === 'map' ? List : MapIcon;
  const label = view === 'map' ? 'List' : 'Map';
  return (
    <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 md:hidden">
      <Button
        type="button"
        size="sm"
        onClick={() => onChange(next)}
        className="rounded-full bg-foreground px-4 py-2 text-background shadow-lg hover:bg-foreground/90"
      >
        <Icon className="mr-1.5 h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
