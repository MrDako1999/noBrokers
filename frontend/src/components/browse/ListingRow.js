import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bath,
  Bed,
  Car,
  ChevronLeft,
  ChevronRight,
  Heart,
  Maximize2,
  Building2,
} from 'lucide-react';
import { formatPrice, formatRent, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const PROPERTY_TYPE_LABELS = {
  condo: 'Apartment',
  apartment: 'Apartment',
  serviced_residence: 'Serviced Residence',
  terrace: 'Terrace',
  semi_detached: 'Semi-Detached',
  bungalow: 'Bungalow',
  townhouse: 'Townhouse',
  land: 'Land',
  commercial: 'Commercial',
  shop_office: 'Shop/Office',
};

// Spitogatos-style horizontal card. Image carousel on the left, dense info
// in the middle, price + actions on the right. Receives hover/focus props
// so the parent can sync state with the map markers.
const ListingRow = forwardRef(function ListingRow(
  {
    listing,
    hovered,
    focused,
    onHover,
    onToggleWatch,
    isWatched,
  },
  ref,
) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = listing.images?.slice(0, 5) || [];
  const cover = images[imgIdx]?.url;

  const isSale = listing.listingType === 'sale';
  const price = isSale ? formatPrice(listing.price) : formatRent(listing.monthlyRent);

  const typeLabel = PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType;
  const sqftLabel = listing.sqft ? `${listing.sqft} sqft` : null;
  const heading = [typeLabel, sqftLabel].filter(Boolean).join(', ');
  const subtitle = [listing.location?.city, listing.location?.state]
    .filter(Boolean)
    .join(' · ');

  const goPrev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImgIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  };
  const goNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImgIdx((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  return (
    <Link
      to={`/listings/${listing._id}`}
      ref={ref}
      onMouseEnter={() => onHover?.(listing._id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-2 transition-all sm:flex-row sm:p-3',
        focused
          ? 'border-primary shadow-md ring-2 ring-primary/40'
          : hovered
            ? 'border-foreground shadow-sm'
            : 'border-sectionBorder hover:border-foreground hover:shadow-sm',
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:aspect-auto sm:h-40 sm:w-56">
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            No photo
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 w-1 rounded-full bg-white/70',
                    i === imgIdx && 'bg-white',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {heading || listing.title}
            </div>
            {subtitle && (
              <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {onToggleWatch && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleWatch(listing._id, !isWatched);
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  isWatched ? 'fill-destructive text-destructive' : 'text-muted-foreground',
                )}
              />
            </button>
          )}
        </div>

        {listing.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {listing.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {listing.bedrooms ? (
            <Chip icon={Bed}>{listing.bedrooms} br</Chip>
          ) : null}
          {listing.bathrooms ? (
            <Chip icon={Bath}>{listing.bathrooms} ba</Chip>
          ) : null}
          {listing.sqft ? (
            <Chip icon={Maximize2}>{listing.sqft} sqft</Chip>
          ) : null}
          {listing.parkingSpaces ? (
            <Chip icon={Car}>{listing.parkingSpaces}</Chip>
          ) : null}
          {!listing.bedrooms && !listing.bathrooms && (
            <Chip icon={Building2}>{typeLabel}</Chip>
          )}
        </div>

        <div className="flex items-end justify-between pt-1.5">
          <div className="text-base font-bold tracking-tight text-foreground">
            {price}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Updated {formatDate(listing.updatedAt || listing.createdAt)}
          </div>
        </div>
      </div>
    </Link>
  );
});

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export default ListingRow;
