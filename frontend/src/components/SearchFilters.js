import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PROPERTY_TYPES, FURNISHING_OPTIONS, MY_STATES } from '@/lib/constants';

// Controlled filter form. The parent owns the URL state (so filters survive
// page reload + sharing). The form just calls `onChange(nextFilters)` whenever
// the user submits, which re-runs the listing query.
export default function SearchFilters({ value, onChange, listingType }) {
  const [local, setLocal] = useState(value);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const update = (patch) => setLocal((prev) => ({ ...prev, ...patch }));

  const submit = (e) => {
    e?.preventDefault?.();
    onChange(local);
  };

  const reset = () => {
    const empty = {};
    setLocal(empty);
    onChange(empty);
  };

  const isRent = listingType === 'rent';

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-sectionBorder bg-card p-4 md:p-5 shadow-sm"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">
          <Label className="mb-1.5 block">Search</Label>
          <Input
            icon={Search}
            placeholder="Title, neighbourhood, description"
            value={local.q || ''}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <Label className="mb-1.5 block">State</Label>
          <Select value={local.state || 'all'} onValueChange={(v) => update({ state: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Any state" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any state</SelectItem>
              {MY_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="mb-1.5 block">City</Label>
          <Input placeholder="Any city" value={local.city || ''} onChange={(e) => update({ city: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <Button type="submit" className="w-full">Search</Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedOpen ? 'Hide' : 'More'} filters
        </button>
        <button type="button" onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">
          Reset
        </button>
      </div>

      {advancedOpen && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="mb-1.5 block">Property type</Label>
            <Select
              value={local.propertyType || 'all'}
              onValueChange={(v) => update({ propertyType: v === 'all' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any type</SelectItem>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Min bedrooms</Label>
            <Select value={local.bedrooms || 'any'} onValueChange={(v) => update({ bedrooms: v === 'any' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Min bathrooms</Label>
            <Select value={local.bathrooms || 'any'} onValueChange={(v) => update({ bathrooms: v === 'any' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Furnishing</Label>
            <Select
              value={local.furnished || 'any'}
              onValueChange={(v) => update({ furnished: v === 'any' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {FURNISHING_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isRent ? (
            <>
              <div>
                <Label className="mb-1.5 block">Min rent (RM)</Label>
                <Input type="number" min="0" value={local.minRent || ''} onChange={(e) => update({ minRent: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Max rent (RM)</Label>
                <Input type="number" min="0" value={local.maxRent || ''} onChange={(e) => update({ maxRent: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="mb-1.5 block">Min price (RM)</Label>
                <Input type="number" min="0" value={local.minPrice || ''} onChange={(e) => update({ minPrice: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Max price (RM)</Label>
                <Input type="number" min="0" value={local.maxPrice || ''} onChange={(e) => update({ maxPrice: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <Label className="mb-1.5 block">Min sqft</Label>
            <Input type="number" min="0" value={local.minSqft || ''} onChange={(e) => update({ minSqft: e.target.value })} />
          </div>

          <div>
            <Label className="mb-1.5 block">Max sqft</Label>
            <Input type="number" min="0" value={local.maxSqft || ''} onChange={(e) => update({ maxSqft: e.target.value })} />
          </div>
        </div>
      )}
    </form>
  );
}
