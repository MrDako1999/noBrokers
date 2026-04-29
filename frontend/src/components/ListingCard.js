import { Link } from 'react-router-dom';
import { Heart, Bed, Bath, Maximize2, MapPin, Car, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatRent } from '@/lib/format';
import { cn } from '@/lib/utils';

const PROPERTY_TYPE_LABELS = {
  condo: 'Condo',
  apartment: 'Apartment',
  serviced_residence: 'Serviced',
  terrace: 'Terrace',
  semi_detached: 'Semi-D',
  bungalow: 'Bungalow',
  townhouse: 'Townhouse',
  land: 'Land',
  commercial: 'Commercial',
  shop_office: 'Shop/Office',
};

export default function ListingCard({ listing, onToggleWatch, isWatched }) {
  if (!listing) return null;

  const cover = listing.images?.[0]?.url;
  const isSale = listing.listingType === 'sale';
  const price = isSale ? formatPrice(listing.price) : formatRent(listing.monthlyRent);
  const ownerVerified = listing.owner?.kyc?.status === 'verified';

  return (
    <Link
      to={`/listings/${listing._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sectionBorder bg-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
            No photo
          </div>
        )}

        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant={isSale ? 'default' : 'info'}>{isSale ? 'For Sale' : 'For Rent'}</Badge>
          {ownerVerified && (
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verified owner
            </Badge>
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
            className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white"
            aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Heart
              className={cn('h-4 w-4', isWatched ? 'fill-destructive text-destructive' : 'text-muted-foreground')}
            />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-semibold tracking-tight font-heading">{price}</div>
          {listing.propertyType && (
            <span className="text-xs text-muted-foreground">
              {PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType}
            </span>
          )}
        </div>

        <h3 className="line-clamp-1 text-sm font-medium text-foreground">{listing.title}</h3>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="line-clamp-1">
            {[listing.location?.city, listing.location?.state].filter(Boolean).join(', ') || '—'}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
          {listing.bedrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" />
              {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              {listing.bathrooms}
            </span>
          )}
          {listing.sqft ? (
            <span className="inline-flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              {listing.sqft} sqft
            </span>
          ) : null}
          {listing.parkingSpaces ? (
            <span className="inline-flex items-center gap-1">
              <Car className="h-3.5 w-3.5" />
              {listing.parkingSpaces}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
