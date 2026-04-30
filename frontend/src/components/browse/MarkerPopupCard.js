import { Link } from 'react-router-dom';
import { Bath, Bed, Heart, Image as ImageIcon, MapPin, Maximize2, X } from 'lucide-react';
import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { formatPrice, formatRent } from '@/lib/format';
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

// Anchor the card so its tip sits ~14px above the price bubble.
const offsetAbove = (w, h) => ({ x: -(w / 2), y: -h - 18 });

// Floating preview card. `variant`:
//   - "hover":  pointer-events disabled, no close button, fades in fast
//   - "focus":  fully interactive, close button, View link
export default function MarkerPopupCard({ listing, variant = 'focus', onClose }) {
  if (!listing) return null;
  const coords = listing.location?.geo?.coordinates;
  if (!coords || coords.length !== 2) return null;
  const [lng, lat] = coords;

  const isSale = listing.listingType === 'sale';
  const price = isSale ? formatPrice(listing.price) : formatRent(listing.monthlyRent);
  const cover = listing.images?.[0]?.url;
  const typeLabel = PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType;
  const sqftLabel = listing.sqft ? `${listing.sqft} sqft` : null;
  const heading = [typeLabel, sqftLabel].filter(Boolean).join(', ');
  const subtitle = [listing.location?.city, listing.location?.state]
    .filter(Boolean)
    .join(' · ');

  const isHover = variant === 'hover';

  return (
    <OverlayViewF
      position={{ lat, lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={offsetAbove}
      zIndex={isHover ? 1500 : 2000}
    >
      <div
        className={cn(
          'w-64 overflow-hidden rounded-xl border border-sectionBorder bg-card shadow-2xl transition-all duration-150',
          isHover && 'pointer-events-none',
        )}
      >
        <div className="relative aspect-[16/10] bg-muted">
          {cover ? (
            <img
              src={cover}
              alt={listing.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5 opacity-50" />
            </div>
          )}
          {!isHover && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-foreground shadow hover:bg-white"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
            {isSale ? 'For Sale' : 'For Rent'}
          </span>
        </div>

        <div className="space-y-1.5 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {heading}
              </div>
              {subtitle && (
                <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {listing.bedrooms ? (
              <span className="inline-flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" />
                {listing.bedrooms} br
              </span>
            ) : null}
            {listing.bathrooms ? (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                {listing.bathrooms} ba
              </span>
            ) : null}
            {listing.sqft ? (
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5" />
                {listing.sqft} sqft
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-base font-bold tracking-tight text-foreground">
              {price}
            </span>
            {isHover ? (
              <Heart className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Link
                to={`/listings/${listing._id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-foreground"
              >
                View
              </Link>
            )}
          </div>
        </div>
      </div>
    </OverlayViewF>
  );
}
