import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookmarkPlus } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PROPERTY_TYPES,
  FURNISHING_OPTIONS,
} from '@/lib/constants';

// Spitogatos-style horizontal pill filter bar. Each pill is a Popover with
// the relevant inputs inside; the pill label flips to the chosen value(s)
// so the bar is glanceable at a single look.
export default function FilterPillBar({
  listingType,
  filters,
  onChange,
  onSaveSearch,
}) {
  const navigate = useNavigate();
  const isRent = listingType === 'rent';

  const setListingType = (v) => navigate(v === 'rent' ? '/rent' : '/buy');

  const propertyType = filters.propertyType || '';
  const propertyTypeLabel =
    PROPERTY_TYPES.find((t) => t.value === propertyType)?.label || 'Property type';

  const minPriceKey = isRent ? 'minRent' : 'minPrice';
  const maxPriceKey = isRent ? 'maxRent' : 'maxPrice';
  const minPriceVal = filters[minPriceKey] || '';
  const maxPriceVal = filters[maxPriceKey] || '';
  const priceLabel = priceSummary(minPriceVal, maxPriceVal, isRent);

  const minSqftVal = filters.minSqft || '';
  const maxSqftVal = filters.maxSqft || '';
  const surfaceLabel = surfaceSummary(minSqftVal, maxSqftVal);

  const bedroomsLabel = filters.bedrooms ? `${filters.bedrooms}+ beds` : 'Beds';
  const bathroomsLabel = filters.bathrooms ? `${filters.bathrooms}+ baths` : 'Baths';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Rent / Sale segmented control */}
      <div className="inline-flex rounded-full border border-sectionBorder bg-card p-0.5">
        <button
          type="button"
          onClick={() => setListingType('rent')}
          className={cn(
            'rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
            isRent ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Rent
        </button>
        <button
          type="button"
          onClick={() => setListingType('sale')}
          className={cn(
            'rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
            !isRent ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Sale
        </button>
      </div>

      <Pill
        label={propertyTypeLabel}
        active={!!propertyType}
        onClear={propertyType ? () => onChange({ propertyType: '' }) : null}
      >
        <div className="space-y-1">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ propertyType: t.value })}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                propertyType === t.value && 'bg-accent font-medium',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Pill>

      <Pill
        label={priceLabel}
        active={!!(minPriceVal || maxPriceVal)}
        onClear={
          minPriceVal || maxPriceVal
            ? () => onChange({ [minPriceKey]: '', [maxPriceKey]: '' })
            : null
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={minPriceVal}
                onChange={(e) => onChange({ [minPriceKey]: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                min="0"
                placeholder="No max"
                value={maxPriceVal}
                onChange={(e) => onChange({ [maxPriceKey]: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isRent ? 'Monthly rent (RM)' : 'Asking price (RM)'}
          </p>
        </div>
      </Pill>

      <Pill
        label={surfaceLabel}
        active={!!(minSqftVal || maxSqftVal)}
        onClear={
          minSqftVal || maxSqftVal
            ? () => onChange({ minSqft: '', maxSqft: '' })
            : null
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Min sqft</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={minSqftVal}
              onChange={(e) => onChange({ minSqft: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max sqft</Label>
            <Input
              type="number"
              min="0"
              placeholder="No max"
              value={maxSqftVal}
              onChange={(e) => onChange({ maxSqft: e.target.value })}
            />
          </div>
        </div>
      </Pill>

      <Pill
        label={bedroomsLabel}
        active={!!filters.bedrooms}
        onClear={filters.bedrooms ? () => onChange({ bedrooms: '' }) : null}
      >
        <NumberStrip
          options={[1, 2, 3, 4, 5]}
          value={filters.bedrooms}
          onChange={(v) => onChange({ bedrooms: v })}
        />
      </Pill>

      <Pill
        label={bathroomsLabel}
        active={!!filters.bathrooms}
        onClear={filters.bathrooms ? () => onChange({ bathrooms: '' }) : null}
      >
        <NumberStrip
          options={[1, 2, 3, 4]}
          value={filters.bathrooms}
          onChange={(v) => onChange({ bathrooms: v })}
        />
      </Pill>

      <Pill label="Filters" active={!!(filters.furnished || filters.q)} onClear={null}>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Search keywords</Label>
            <Input
              placeholder="View, MRT, refurbished…"
              value={filters.q || ''}
              onChange={(e) => onChange({ q: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Furnishing</Label>
            <div className="flex flex-wrap gap-1.5">
              {FURNISHING_OPTIONS.map((f) => {
                const active = filters.furnished === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() =>
                      onChange({ furnished: active ? '' : f.value })
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-inputBorderIdle hover:border-inputBorderFocus',
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Pill>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSaveSearch}
          className="bg-[#f97316] text-white hover:bg-[#ea580c]"
        >
          <BookmarkPlus className="mr-1.5 h-4 w-4" />
          Save search
        </Button>
      </div>
    </div>
  );
}

function Pill({ label, active, onClear, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
            active
              ? 'border-foreground bg-foreground text-background'
              : 'border-sectionBorder bg-card text-foreground hover:border-foreground',
          )}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          {onClear && (
            <span
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              className="ml-1 -mr-1 grid h-4 w-4 place-items-center rounded-full bg-background/30 text-[10px] leading-none hover:bg-background/50"
              aria-label={`Clear ${label}`}
            >
              ×
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">{children}</PopoverContent>
    </Popover>
  );
}

function NumberStrip({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((n) => {
        const v = String(n);
        const active = value === v;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? '' : v)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-inputBorderIdle hover:border-inputBorderFocus',
            )}
          >
            {n}+
          </button>
        );
      })}
    </div>
  );
}

function priceSummary(min, max, isRent) {
  const suffix = isRent ? '/mo' : '';
  if (!min && !max) return 'Price';
  const fmt = (n) => `RM${shortNumber(n)}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}${suffix}`;
  if (min) return `> ${fmt(min)}${suffix}`;
  return `< ${fmt(max)}${suffix}`;
}

function surfaceSummary(min, max) {
  if (!min && !max) return 'Surface';
  if (min && max) return `${min} – ${max} sqft`;
  if (min) return `> ${min} sqft`;
  return `< ${max} sqft`;
}

function shortNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return n;
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return num;
}
