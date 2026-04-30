// Group listings that share the same plot/building so we can collapse them
// into a single "multi-unit" marker on the map. Two listings count as the
// same building when their lat/lng round to the same 4-decimal cell — that's
// roughly 11 metres on the ground, tight enough to avoid false positives but
// generous enough to absorb GPS jitter between units in the same condo.
//
// Returns: [{ key, lat, lng, listings }]

const PRECISION = 4;

function roundCoord(n) {
  return Number(n).toFixed(PRECISION);
}

export function groupListings(listings) {
  const map = new Map();
  for (const l of listings) {
    const c = l.location?.geo?.coordinates;
    if (!c || c.length !== 2) continue;
    const [lng, lat] = c;
    const key = `${roundCoord(lng)},${roundCoord(lat)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
  }
  return Array.from(map.entries()).map(([key, group]) => {
    const [lng, lat] = key.split(',').map(Number);
    return { key, lat, lng, listings: group };
  });
}

// Reverse lookup — given a single listing _id, find the group it belongs to.
// Used by the popup-card layer in ListingMap to decide between the single-unit
// card and the multi-unit (carousel) card.
export function findGroupContaining(groups, listingId) {
  if (!listingId) return null;
  return (
    groups.find((g) => g.listings.some((l) => l._id === listingId)) || null
  );
}

// Pick a stable "spokesperson" listing for a multi-unit group — used as the
// id we report up to BrowsePage for hover/focus state. We pick the cheapest
// so the row that ends up highlighted in the list is at least the headline.
export function pickRepresentative(group) {
  if (!group?.listings?.length) return null;
  const sorted = [...group.listings].sort((a, b) => {
    const av = a.listingType === 'sale' ? a.price : a.monthlyRent;
    const bv = b.listingType === 'sale' ? b.price : b.monthlyRent;
    return (av || 0) - (bv || 0);
  });
  return sorted[0];
}
