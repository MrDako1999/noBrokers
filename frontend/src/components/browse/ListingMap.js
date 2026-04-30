import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Loader2, MapPin } from 'lucide-react';
import { MY_CENTER, useGoogleMaps } from '@/lib/googleMapsUtils';
import MarkerCluster from './MarkerCluster';
import MarkerPopupCard from './MarkerPopupCard';

const containerStyle = { width: '100%', height: '100%' };

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
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
        if (added === 1) {
          // Don't zoom too tight on a single result.
          const z = map.getZoom();
          if (z && z > 15) map.setZoom(15);
        }
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

  const focusedListing = focusedId
    ? listings.find((l) => l._id === focusedId)
    : null;

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
        listings={listings}
        hoveredId={hoveredId}
        focusedId={focusedId}
        onHover={onHover}
        onSelect={onSelect}
      />
      {focusedListing && (
        <MarkerPopupCard listing={focusedListing} onClose={() => onSelect?.(null)} />
      )}
      {children}
    </GoogleMap>
  );
}
