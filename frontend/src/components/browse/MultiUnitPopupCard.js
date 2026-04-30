import { Link } from 'react-router-dom';
import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { Bath, Bed, Image as ImageIcon, MapPin, X } from 'lucide-react';
import { formatPrice, formatRent } from '@/lib/format';
import { cn } from '@/lib/utils';

const offsetAbove = (w, h) => ({ x: -(w / 2), y: -h - 18 });

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

// Floating card that anchors above a multi-unit marker. Shows up to 3 units
// stacked vertically (Spitogatos's "3 listings" pattern). variant=hover is
// pointer-events: none so it fades the moment the user moves off the marker;
// variant=focus is fully interactive with a close button + clickable rows.
export default function MultiUnitPopupCard({ group, variant = 'focus', onClose }) {
  if (!group?.listings?.length) return null;
  const { lat, lng, listings } = group;
  const isHover = variant === 'hover';

  const visible = listings.slice(0, 3);
  const overflow = listings.length - visible.length;
  const subtitle = [listings[0].location?.city, listings[0].location?.state]
    .filter(Boolean)
    .join(' · ');

  return (
    <OverlayViewF
      position={{ lat, lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={offsetAbove}
      zIndex={isHover ? 1500 : 2000}
    >
      <div
        className={cn(
          'w-80 overflow-hidden rounded-xl border border-sectionBorder bg-card shadow-2xl',
          isHover && 'pointer-events-none',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sectionBorder px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {listings.length} listings
            </span>
            {subtitle && (
              <span className="truncate text-muted-foreground">· {subtitle}</span>
            )}
          </div>
          {!isHover && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <ul className="divide-y divide-sectionBorder">
          {visible.map((listing) => {
            const isSale = listing.listingType === 'sale';
            const price = isSale
              ? formatPrice(listing.price)
              : formatRent(listing.monthlyRent);
            const cover = listing.images?.[0]?.url;
            const typeLabel =
              PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType;
            const sqftLabel = listing.sqft ? `${listing.sqft} sqft` : null;
            const heading = [typeLabel, sqftLabel].filter(Boolean).join(', ');

            const Inner = (
              <div className="flex items-center gap-2.5 p-2.5">
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {cover ? (
                    <img
                      src={cover}
                      alt={listing.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-foreground">{price}{!isSale && <span className="text-xs font-medium text-muted-foreground"> / mo</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{heading}</div>
                  <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                    {listing.bedrooms ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Bed className="h-3 w-3" />
                        {listing.bedrooms}
                      </span>
                    ) : null}
                    {listing.bathrooms ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Bath className="h-3 w-3" />
                        {listing.bathrooms}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );

            return (
              <li key={listing._id}>
                {isHover ? (
                  Inner
                ) : (
                  <Link
                    to={`/listings/${listing._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block transition-colors hover:bg-accent"
                  >
                    {Inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {overflow > 0 && (
          <div className="border-t border-sectionBorder bg-muted/40 px-3 py-1.5 text-center text-xs text-muted-foreground">
            +{overflow} more in this building
          </div>
        )}
      </div>
    </OverlayViewF>
  );
}
