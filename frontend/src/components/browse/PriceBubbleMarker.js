import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { cn } from '@/lib/utils';
import { formatPriceShort, formatRentShort } from '@/lib/format';

// Centres the overlay's anchor point on the marker's lat/lng. Without this
// Google's default offset puts the overlay's top-left at the coordinate.
const offsetByCenter = (w, h) => ({ x: -(w / 2), y: -(h / 2) });

// Spitogatos-style orange price pill rendered as an HTML overlay so we can
// hover/click it like a normal DOM element. Z-index gets bumped when hovered
// or focused so an active marker always wins over its neighbours.
export default function PriceBubbleMarker({
  listing,
  hovered,
  focused,
  onHover,
  onSelect,
}) {
  const coords = listing.location?.geo?.coordinates;
  if (!coords || coords.length !== 2) return null;
  const [lng, lat] = coords;

  const isSale = listing.listingType === 'sale';
  const label = isSale
    ? formatPriceShort(listing.price)
    : formatRentShort(listing.monthlyRent);

  return (
    <OverlayViewF
      position={{ lat, lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={offsetByCenter}
      zIndex={focused ? 1000 : hovered ? 500 : 1}
    >
      <button
        type="button"
        onMouseEnter={() => onHover?.(listing._id)}
        onMouseLeave={() => onHover?.(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(listing._id);
        }}
        className={cn(
          'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none shadow-md transition-all',
          'border border-transparent select-none cursor-pointer',
          focused
            ? 'bg-foreground text-background scale-110 ring-2 ring-primary'
            : hovered
              ? 'bg-primary text-primary-foreground scale-105'
              : 'bg-[#f97316] text-white hover:bg-[#ea580c]',
        )}
      >
        {label}
      </button>
    </OverlayViewF>
  );
}
