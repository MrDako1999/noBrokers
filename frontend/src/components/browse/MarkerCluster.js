import { useCallback, useEffect, useState } from 'react';
import {
  MarkerClustererF,
  MarkerF,
  useGoogleMap,
} from '@react-google-maps/api';
import PriceBubbleMarker from './PriceBubbleMarker';

// Build a small SVG so cluster bubbles use noBrokers' orange and don't depend
// on the bundled m1/m2 PNGs from the legacy clusterer.
function clusterIconSvg(diameter) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}">
      <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2 - 2}" fill="#f97316" stroke="white" stroke-width="3" opacity="0.95"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const CLUSTER_STYLES = [
  { url: clusterIconSvg(40), height: 40, width: 40, textColor: 'white', textSize: 13 },
  { url: clusterIconSvg(50), height: 50, width: 50, textColor: 'white', textSize: 14 },
  { url: clusterIconSvg(60), height: 60, width: 60, textColor: 'white', textSize: 15 },
  { url: clusterIconSvg(70), height: 70, width: 70, textColor: 'white', textSize: 16 },
];

// Below this zoom we cluster aggressively. Above it, every marker renders
// individually so the price labels are readable without zooming further.
const CLUSTER_MAX_ZOOM = 13;

// MarkerClustererF can only cluster real google.maps.Marker children, not
// our HTML PriceBubbleMarker overlays. We use the clusterer below the zoom
// threshold (cheap orange bubbles) and switch to individual price bubbles
// once the user zooms in past the threshold.
export default function MarkerCluster({
  listings,
  hoveredId,
  focusedId,
  onHover,
  onSelect,
}) {
  const map = useGoogleMap();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 11);

  useEffect(() => {
    if (!map) return undefined;
    setZoom(map.getZoom() ?? 11);
    const listener = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 11);
    });
    return () => listener.remove();
  }, [map]);

  const validListings = listings.filter(
    (l) => l.location?.geo?.coordinates?.length === 2,
  );

  const handleClusterClick = useCallback((cluster) => {
    const m = cluster.getMap();
    if (m) m.fitBounds(cluster.getBounds());
  }, []);

  if (zoom > CLUSTER_MAX_ZOOM) {
    return validListings.map((listing) => (
      <PriceBubbleMarker
        key={listing._id}
        listing={listing}
        hovered={hoveredId === listing._id}
        focused={focusedId === listing._id}
        onHover={onHover}
        onSelect={onSelect}
      />
    ));
  }

  const clustererOptions = {
    styles: CLUSTER_STYLES,
    maxZoom: CLUSTER_MAX_ZOOM,
    averageCenter: true,
    gridSize: 60,
    minimumClusterSize: 2,
  };

  return (
    <MarkerClustererF options={clustererOptions} onClick={handleClusterClick}>
      {(clusterer) =>
        validListings.map((listing) => {
          const [lng, lat] = listing.location.geo.coordinates;
          return (
            <MarkerF
              key={listing._id}
              position={{ lat, lng }}
              clusterer={clusterer}
              opacity={0}
              onClick={() => onSelect?.(listing._id)}
              onMouseOver={() => onHover?.(listing._id)}
              onMouseOut={() => onHover?.(null)}
            />
          );
        })
      }
    </MarkerClustererF>
  );
}
