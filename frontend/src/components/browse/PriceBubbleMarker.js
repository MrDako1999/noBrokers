import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { cn } from '@/lib/utils';
import { formatPriceShort, formatRentShort } from '@/lib/format';

// Centres the overlay's anchor point on the marker's lat/lng. Without this
// Google's default offset puts the overlay's top-left at the coordinate.
const offsetByCenter = (w, h) => ({ x: -(w / 2), y: -(h / 2) });

// Zoom tiers — Spitogatos shows tiny dots when far out, mid-size pills with
// no price between, and full price pills once you're close enough that the
// label is meaningful. We bias toward showing the price as soon as we can:
// users want to compare prices, and the dot-only state is mostly for very
// far-zoom-out where labels would overlap.
//
//   <= TIER_DOT_MAX     -> small filled dot (no text)
//   <= TIER_PILL_MAX    -> compact pill, price hidden until hover
//   >  TIER_PILL_MAX    -> full price pill
const TIER_DOT_MAX = 9;
const TIER_PILL_MAX = 11;

export default function PriceBubbleMarker({
  listing,
  zoom = 14,
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

  const tier = focused || hovered
    ? 'full' // always show the price for the active marker
    : zoom <= TIER_DOT_MAX
      ? 'dot'
      : zoom <= TIER_PILL_MAX
        ? 'mini'
        : 'full';

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
          'select-none cursor-pointer whitespace-nowrap font-semibold leading-none transition-all duration-150',
          tier === 'dot' &&
            'h-2.5 w-2.5 rounded-full p-0 shadow-sm ring-2 ring-white/80 bg-primary',
          tier === 'mini' &&
            'h-3 w-3 rounded-full p-0 shadow ring-2 ring-white bg-primary',
          tier === 'full' &&
            'rounded-full border border-black/5 px-2.5 py-1 text-[11px] shadow-md',
          // Color states for the pill tier
          tier === 'full' &&
            (focused
              ? 'bg-foreground text-background scale-110 ring-2 ring-primary'
              : hovered
                ? 'bg-foreground text-background scale-110 shadow-lg'
                : 'bg-primary text-primary-foreground hover:bg-foreground'),
          // Color states for dot/mini (just brighten on hover/focus)
          (tier === 'dot' || tier === 'mini') &&
            (focused
              ? 'scale-125 ring-foreground'
              : hovered
                ? 'scale-125 shadow-lg'
                : ''),
        )}
      >
        {tier === 'full' ? label : null}
      </button>
    </OverlayViewF>
  );
}
