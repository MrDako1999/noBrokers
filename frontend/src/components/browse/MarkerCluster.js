import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MarkerClustererF,
  MarkerF,
  useGoogleMap,
} from '@react-google-maps/api';
import PriceBubbleMarker from './PriceBubbleMarker';
import MultiUnitMarker from './MultiUnitMarker';
import { BRAND_TEAL } from './mapColors';

// Build teal cluster bubbles so we don't depend on the bundled m1..m5 PNGs
// from the legacy clusterer. SVG with a soft outer halo matches the
// PriceBubbleMarker styling.
function clusterIconSvg(diameter) {
  const r = diameter / 2;
  const teal = BRAND_TEAL;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}">
      <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${teal}" opacity="0.18"/>
      <circle cx="${r}" cy="${r}" r="${r - 7}" fill="${teal}" stroke="white" stroke-width="3"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const CLUSTER_STYLES = [
  { url: clusterIconSvg(46), height: 46, width: 46, textColor: 'white', textSize: 12, fontWeight: '700' },
  { url: clusterIconSvg(54), height: 54, width: 54, textColor: 'white', textSize: 13, fontWeight: '700' },
  { url: clusterIconSvg(64), height: 64, width: 64, textColor: 'white', textSize: 14, fontWeight: '700' },
  { url: clusterIconSvg(76), height: 76, width: 76, textColor: 'white', textSize: 15, fontWeight: '700' },
  { url: clusterIconSvg(92), height: 92, width: 92, textColor: 'white', textSize: 16, fontWeight: '800' },
];

// Pick a style bucket by cluster count. Tighter ramp than the default
// log-based one so small clusters still look distinct from singletons.
function clusterCalculator(markers) {
  const count = markers.length;
  let index;
  if (count < 10) index = 1;
  else if (count < 25) index = 2;
  else if (count < 100) index = 3;
  else if (count < 500) index = 4;
  else index = 5;
  return { text: String(count), index, title: `${count} properties` };
}

// Render strategy:
//   * Address-grouping (`groups`) handles same-building stacking — multiple
//     listings at one lat/lng collapse into a MultiUnitMarker.
//   * Spatial-clustering (MarkerClustererF) handles nearby-but-not-same
//     buildings — when the camera zooms out, neighbours collapse into an
//     orange numbered cluster bubble.
//   * Anything not currently absorbed into a spatial cluster shows its own
//     PriceBubble or MultiUnitMarker.
export default function MarkerCluster({
  groups,
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

  // Pick a single representative listing from each group to feed the spatial
  // clusterer. Same group -> one entry, so the cluster count matches the
  // number of *buildings*, not the number of units.
  const repsByGroupKey = useMemo(() => {
    const out = new Map();
    for (const g of groups) {
      out.set(g.key, g.listings[0]);
    }
    return out;
  }, [groups]);

  // Set of group keys currently absorbed into a multi-building spatial
  // cluster bubble. Anything not in this set renders its own marker.
  const [clusteredKeys, setClusteredKeys] = useState(() => new Set());
  const markerToKeyRef = useRef(new Map());

  const handleClusteringEnd = useCallback((clusterer) => {
    const next = new Set();
    const clusters = clusterer.getClusters?.() || [];
    for (const cluster of clusters) {
      const markers = cluster.getMarkers?.() || [];
      if (markers.length < 2) continue;
      for (const m of markers) {
        const k = markerToKeyRef.current.get(m);
        if (k) next.add(k);
      }
    }
    setClusteredKeys((prev) => {
      if (prev.size === next.size) {
        let same = true;
        for (const k of prev) {
          if (!next.has(k)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, []);

  const handleClusterClick = useCallback((cluster) => {
    const m = cluster.getMap();
    if (m) m.fitBounds(cluster.getBounds());
  }, []);

  const clustererOptions = useMemo(
    () => ({
      styles: CLUSTER_STYLES,
      maxZoom: 16,
      averageCenter: true,
      gridSize: 50,
      minimumClusterSize: 2,
      calculator: clusterCalculator,
    }),
    [],
  );

  return (
    <>
      <MarkerClustererF
        options={clustererOptions}
        onClick={handleClusterClick}
        onClusteringEnd={handleClusteringEnd}
      >
        {(clusterer) =>
          Array.from(repsByGroupKey.entries()).map(([groupKey, rep]) => {
            const [lng, lat] = rep.location.geo.coordinates;
            return (
              <MarkerF
                key={groupKey}
                position={{ lat, lng }}
                clusterer={clusterer}
                opacity={0}
                clickable={false}
                onLoad={(m) => {
                  markerToKeyRef.current.set(m, groupKey);
                }}
                onUnmount={(m) => {
                  markerToKeyRef.current.delete(m);
                }}
              />
            );
          })
        }
      </MarkerClustererF>

      {groups.map((group) => {
        if (clusteredKeys.has(group.key)) return null;

        if (group.listings.length > 1) {
          const id = `multi:${group.key}`;
          return (
            <MultiUnitMarker
              key={group.key}
              group={group}
              zoom={zoom}
              hovered={hoveredId === id}
              focused={focusedId === id}
              onHover={onHover}
              onSelect={onSelect}
            />
          );
        }

        const listing = group.listings[0];
        return (
          <PriceBubbleMarker
            key={listing._id}
            listing={listing}
            zoom={zoom}
            hovered={hoveredId === listing._id}
            focused={focusedId === listing._id}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}
