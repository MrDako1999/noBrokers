import { Link } from 'react-router-dom';
import { Bath, Bed, Maximize2, X } from 'lucide-react';
import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { formatPrice, formatRent } from '@/lib/format';

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

// Anchor the card so its tip sits ~12px above the price bubble.
const offsetAbove = (w, h) => ({ x: -(w / 2), y: -h - 18 });

// Mini hover/focus card that pops above a marker. Uses the same map pane as
// the price bubbles so it captures clicks (so the user can tap "View" without
// the map intercepting it).
export default function MarkerPopupCard({ listing, onClose }) {
  if (!listing) return null;
  const coords = listing.location?.geo?.coordinates;
  if (!coords || coords.length !== 2) return null;
  const [lng, lat] = coords;

  const isSale = listing.listingType === 'sale';
  const price = isSale ? formatPrice(listing.price) : formatRent(listing.monthlyRent);
  const cover = listing.images?.[0]?.url;
  const typeLabel = PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType;

  return (
    <OverlayViewF
      position={{ lat, lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={offsetAbove}
      zIndex={2000}
    >
      <div className="w-64 overflow-hidden rounded-xl border border-sectionBorder bg-card shadow-2xl">
        <div className="relative aspect-[16/10] bg-muted">
          {cover ? (
            <img
              src={cover}
              alt={listing.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              No photo
            </div>
          )}
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
        </div>
        <div className="space-y-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">
                {typeLabel}
                {listing.location?.city ? ` · ${listing.location.city}` : ''}
              </div>
              <div className="truncate text-sm font-semibold text-foreground">
                {listing.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {listing.bedrooms ? (
              <span className="inline-flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" />
                {listing.bedrooms}
              </span>
            ) : null}
            {listing.bathrooms ? (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                {listing.bathrooms}
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
            <Link
              to={`/listings/${listing._id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-[#f97316] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#ea580c]"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </OverlayViewF>
  );
}
