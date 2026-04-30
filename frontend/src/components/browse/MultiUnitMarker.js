import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';
import { cn } from '@/lib/utils';
import { formatPriceShort, formatRentShort } from '@/lib/format';

const offsetByCenter = (w, h) => ({ x: -(w / 2), y: -(h / 2) });

// "From X" pill with a small count badge — used when 2+ listings share the
// same lat/lng (i.e. multiple units in the same condo or plot). Visually
// distinct from a single-unit price pill so users immediately read it as
// "tap to see all units in this building".
//
// The id reported back via onHover/onSelect is `multi:<groupKey>` so the
// parent can route popup-card rendering to MultiUnitPopupCard.
export default function MultiUnitMarker({
  group,
  zoom = 14,
  hovered,
  focused,
  onHover,
  onSelect,
}) {
  const { listings, lat, lng, key } = group;
  const id = `multi:${key}`;

  // Cheapest price across the group sets the "From" label so the marker
  // matches what a user would expect a search-anchor to show.
  const isAllSale = listings.every((l) => l.listingType === 'sale');
  const isAllRent = listings.every((l) => l.listingType === 'rent');

  let label;
  if (isAllSale) {
    const min = Math.min(...listings.map((l) => l.price || 0).filter(Boolean));
    label = `From ${formatPriceShort(min)}`;
  } else if (isAllRent) {
    const min = Math.min(
      ...listings.map((l) => l.monthlyRent || 0).filter(Boolean),
    );
    label = `From ${formatRentShort(min)}`;
  } else {
    label = `${listings.length} listings`;
  }

  const compact = zoom <= 11;

  return (
    <OverlayViewF
      position={{ lat, lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={offsetByCenter}
      zIndex={focused ? 1000 : hovered ? 500 : 2}
    >
      <button
        type="button"
        onMouseEnter={() => onHover?.(id)}
        onMouseLeave={() => onHover?.(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(id);
        }}
        className={cn(
          'relative inline-flex select-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none transition-all duration-150',
          compact
            ? 'h-6 w-6 justify-center p-0 text-[10px] shadow-md ring-2 ring-white'
            : 'border border-black/5 px-2.5 py-1 text-[11px] shadow-md',
          focused
            ? 'bg-foreground text-background scale-110 ring-2 ring-primary'
            : hovered
              ? 'bg-foreground text-background scale-110 shadow-lg'
              : 'bg-primary text-primary-foreground hover:bg-foreground',
        )}
      >
        {compact ? listings.length : (
          <>
            {label}
            <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-white/95 px-1 text-[10px] font-bold text-primary">
              {listings.length}
            </span>
          </>
        )}
      </button>
    </OverlayViewF>
  );
}
