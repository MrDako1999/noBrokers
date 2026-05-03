import { Loader2 } from 'lucide-react';

// Spitogatos-style "Search as I move the map" pill that sits over the map.
// Visually mirrors their chip exactly: white pill, checkbox, optional spinner.
export default function SearchAsIMoveToggle({ checked, onChange, isFetching }) {
  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <label className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-sectionBorder bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-md hover:bg-muted">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-primary"
        />
        Search as I move the map
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </label>
    </div>
  );
}
