import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Loader2, MapPin } from 'lucide-react';
import { MY_CENTER, useGoogleMaps } from '@/lib/googleMapsUtils';
import MarkerCluster from './MarkerCluster';
import MarkerPopupCard from './MarkerPopupCard';
import MultiUnitPopupCard from './MultiUnitPopupCard';
import { findGroupContaining, groupListings } from './groupListings';

const containerStyle = { width: '100%', height: '100%' };

// Hide Google's default POI / transit / business icons — they look almost
// identical to our orange price bubbles and create visual clutter that the
// user mistakes for their own listings. Roads, water, and admin labels stay.
const HIDE_POI_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
];

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  styles: HIDE_POI_STYLES,
};

// Hosts the Google Map + the marker layer + the marker popup card. The parent
// (BrowsePage) owns hovered/focused state so the list and the map stay in
// lock-step.
export default function ListingMap({
  listings,
  hoveredId,
  focusedId,
  onHover,
  onSelect,
  onIdle,
  onMapReady,
  initialBbox,
  children,
}) {
  const { isLoaded, loadError, apiKey } = useGoogleMaps();
  const [map, setMap] = useState(null);
  const didFitRef = useRef(false);

  const handleLoad = useCallback(
    (m) => {
      setMap(m);
      onMapReady?.(m);
    },
    [onMapReady],
  );

  const handleUnmount = useCallback(() => setMap(null), []);

  // Auto-fit to either the URL bbox or the marker set on first load.
  useEffect(() => {
    if (!map || didFitRef.current) return;
    if (initialBbox) {
      const bounds = new window.google.maps.LatLngBounds(
        { lat: initialBbox.swLat, lng: initialBbox.swLng },
        { lat: initialBbox.neLat, lng: initialBbox.neLng },
      );
      map.fitBounds(bounds, 0);
      didFitRef.current = true;
      return;
    }
    if (listings.length) {
      const bounds = new window.google.maps.LatLngBounds();
      let added = 0;
      for (const l of listings) {
        const c = l.location?.geo?.coordinates;
        if (c?.length === 2) {
          bounds.extend({ lat: c[1], lng: c[0] });
          added += 1;
        }
      }
      if (added > 0) {
        map.fitBounds(bounds, 64);
        // After fitBounds the zoom can be either too tight (single marker) or
        // too loose (markers spread across the country). Clamp to a band that
        // still shows individual price bubbles instead of just clusters.
        window.requestAnimationFrame(() => {
          const z = map.getZoom();
          if (z == null) return;
          if (added === 1 && z > 15) map.setZoom(15);
          if (z < 11) map.setZoom(11);
        });
        didFitRef.current = true;
      }
    }
  }, [map, listings, initialBbox]);

  const handleIdle = useCallback(() => {
    if (!map || !onIdle) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onIdle({
      swLat: sw.lat(),
      swLng: sw.lng(),
      neLat: ne.lat(),
      neLng: ne.lng(),
      zoom: map.getZoom(),
    });
  }, [map, onIdle]);

  // Group listings by address — same lat/lng = same building, so we can
  // collapse multi-unit buildings into a single map marker.
  const groups = useMemo(() => groupListings(listings), [listings]);

  // Resolve hover/focus IDs into "what should the popup show" — either a
  // single listing card, a multi-unit (carousel) card, or nothing. The id
  // convention is: `multi:<groupKey>` for grouped pins, raw `_id` otherwise.
  const resolvePopup = useCallback(
    (id) => {
      if (!id) return null;
      if (id.startsWith('multi:')) {
        const key = id.slice('multi:'.length);
        const group = groups.find((g) => g.key === key);
        return group ? { kind: 'group', group } : null;
      }
      const single = listings.find((l) => l._id === id);
      if (!single) return null;
      const owningGroup = findGroupContaining(groups, id);
      // Single listing inside a multi-unit building -> show the multi-unit
      // card so the user sees its siblings, not just the one row.
      if (owningGroup && owningGroup.listings.length > 1) {
        return { kind: 'group', group: owningGroup };
      }
      return { kind: 'single', listing: single };
    },
    [groups, listings],
  );

  const focusedPopup = resolvePopup(focusedId);
  const hoveredPopup =
    hoveredId && hoveredId !== focusedId ? resolvePopup(hoveredId) : null;

  if (!apiKey) {
    return (
      <div className="grid h-full place-items-center bg-muted">
        <div className="max-w-xs px-6 text-center">
          <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Add <code className="rounded bg-background px-1">VITE_GOOGLE_MAPS_API_KEY</code> to enable the map view.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid h-full place-items-center bg-muted text-sm text-destructive">
        Could not load Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="grid h-full place-items-center bg-muted">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading map…
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={MY_CENTER}
      zoom={11}
      onLoad={handleLoad}
      onUnmount={handleUnmount}
      onIdle={handleIdle}
      options={MAP_OPTIONS}
      onClick={() => onSelect?.(null)}
    >
      <MarkerCluster
        groups={groups}
        hoveredId={hoveredId}
        focusedId={focusedId}
        onHover={onHover}
        onSelect={onSelect}
      />
      {focusedPopup?.kind === 'single' && (
        <MarkerPopupCard
          listing={focusedPopup.listing}
          variant="focus"
          onClose={() => onSelect?.(null)}
        />
      )}
      {focusedPopup?.kind === 'group' && (
        <MultiUnitPopupCard
          group={focusedPopup.group}
          variant="focus"
          onClose={() => onSelect?.(null)}
        />
      )}
      {!focusedPopup && hoveredPopup?.kind === 'single' && (
        <MarkerPopupCard listing={hoveredPopup.listing} variant="hover" />
      )}
      {!focusedPopup && hoveredPopup?.kind === 'group' && (
        <MultiUnitPopupCard group={hoveredPopup.group} variant="hover" />
      )}
      {children}
    </GoogleMap>
  );
}
