import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';
import FilterPillBar from '@/components/browse/FilterPillBar';
import ListingRow from '@/components/browse/ListingRow';
import ListingMap from '@/components/browse/ListingMap';
import SearchAsIMoveToggle from '@/components/browse/SearchAsIMoveToggle';
import DrawTool from '@/components/browse/DrawTool';
import BrowseMobileToggle from '@/components/browse/BrowseMobileToggle';

const PAGE_SIZE = 20;

// Filter keys that participate in URL state but aren't filters per se. We
// strip them when building the API request and when comparing equality.
const NON_FILTER_PARAMS = new Set(['page', 'sort', 'sami', 'view', 'bbox', 'polygon']);

// Single browse page reused for both `/buy` and `/rent` — the route component
// passes `listingType` so we don't fork the file. Layout is split-pane:
// scrollable list on the left, sticky Google Map with price-bubble markers on
// the right. URL holds every piece of shareable state (filters + bbox + draw
// polygon + sami toggle + mobile view).
export default function BrowsePage({ listingType }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    document.title =
      listingType === 'rent'
        ? 'Properties for rent — noBrokers.my'
        : 'Properties for sale — noBrokers.my';
  }, [listingType]);

  // Read URL state on every render. Mutations write back via setSearchParams
  // which triggers a re-render through React Router.
  const filters = useMemo(() => {
    const obj = {};
    for (const [k, v] of searchParams.entries()) {
      if (!NON_FILTER_PARAMS.has(k)) obj[k] = v;
    }
    return obj;
  }, [searchParams]);

  const sort = searchParams.get('sort') || 'newest';
  const samiOn = searchParams.get('sami') === '1';
  const view = searchParams.get('view') === 'map' ? 'map' : 'list';
  const bboxParam = searchParams.get('bbox') || '';
  const polygonParam = searchParams.get('polygon') || '';

  const initialBbox = useMemo(() => parseBbox(bboxParam), [bboxParam]);

  // Two queries in parallel — full rows for the list, lean pins for the map.
  // Both keys include sami so toggling it off/on snaps cleanly.
  const listingsQueryParams = useMemo(
    () => ({ listingType, ...filters, sort, bbox: bboxParam, polygon: polygonParam }),
    [listingType, filters, sort, bboxParam, polygonParam],
  );

  const listQuery = useInfiniteQuery({
    queryKey: ['listings', listingsQueryParams],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get('/listings', {
        params: { ...listingsQueryParams, page: pageParam, limit: PAGE_SIZE },
      });
      return data;
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    keepPreviousData: true,
  });

  const mapQuery = useQuery({
    queryKey: ['listings-map', listingsQueryParams],
    queryFn: async () => {
      const { data } = await api.get('/listings', {
        params: { ...listingsQueryParams, fields: 'map', limit: 250 },
      });
      return data;
    },
    keepPreviousData: true,
    staleTime: 30 * 1000,
  });

  const listItems = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;
  const mapMarkers = mapQuery.data?.items ?? [];

  // Hover/focus state owned here so the list and the map can drive each other.
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const rowRefs = useRef(new Map());

  const setHoverFromMap = useCallback((id) => {
    setHoveredId(id);
    if (id) {
      const el = rowRefs.current.get(id);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  // URL helpers ---------------------------------------------------------------

  const updateFilters = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      Object.keys(next).forEach((k) => {
        if (next[k] === '' || next[k] == null) delete next[k];
      });
      // Reset bbox/polygon when filters change so we don't keep an old viewport
      // restricting an otherwise wider new search.
      const sp = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => sp.set(k, String(v)));
      if (sort && sort !== 'newest') sp.set('sort', sort);
      if (samiOn) sp.set('sami', '1');
      if (view === 'map') sp.set('view', 'map');
      setSearchParams(sp);
    },
    [filters, samiOn, setSearchParams, sort, view],
  );

  const setSort = useCallback(
    (v) => {
      const sp = new URLSearchParams(searchParams);
      if (v === 'newest') sp.delete('sort');
      else sp.set('sort', v);
      setSearchParams(sp);
    },
    [searchParams, setSearchParams],
  );

  const setSami = useCallback(
    (next) => {
      const sp = new URLSearchParams(searchParams);
      if (next) sp.set('sami', '1');
      else {
        sp.delete('sami');
        sp.delete('bbox');
      }
      setSearchParams(sp);
    },
    [searchParams, setSearchParams],
  );

  const setView = useCallback(
    (next) => {
      const sp = new URLSearchParams(searchParams);
      if (next === 'map') sp.set('view', 'map');
      else sp.delete('view');
      setSearchParams(sp);
    },
    [searchParams, setSearchParams],
  );

  const setPolygon = useCallback(
    (poly) => {
      const sp = new URLSearchParams(searchParams);
      if (poly) sp.set('polygon', poly);
      else sp.delete('polygon');
      setSearchParams(sp);
    },
    [searchParams, setSearchParams],
  );

  // Map idle handler — debounced bbox write so we don't thrash the URL while
  // the user is panning. Only writes when SAIM is on.
  const idleTimer = useRef(null);
  const handleMapIdle = useCallback(
    ({ swLat, swLng, neLat, neLng }) => {
      if (!samiOn) return;
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        const next = `${swLng.toFixed(6)},${swLat.toFixed(6)},${neLng.toFixed(6)},${neLat.toFixed(6)}`;
        const sp = new URLSearchParams(searchParams);
        if (sp.get('bbox') !== next) {
          sp.set('bbox', next);
          setSearchParams(sp, { replace: true });
        }
      }, 400);
    },
    [samiOn, searchParams, setSearchParams],
  );

  // Watchlist toggle (mirrors the old page; updates both queries optimistically).
  const watchMutation = useMutation({
    mutationFn: async ({ listingId, next }) => {
      if (next) await api.post(`/watchlist/${listingId}`);
      else await api.delete(`/watchlist/${listingId}`);
      return { listingId, next };
    },
    onSuccess: ({ listingId, next }) => {
      queryClient.setQueryData(['listings', listingsQueryParams], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((i) =>
              i._id === listingId ? { ...i, inWatchlist: next } : i,
            ),
          })),
        };
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not update watchlist',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  const onToggleWatch = (listingId, next) => {
    if (!user) {
      toast({
        title: 'Sign in to save listings',
        description: 'Create a free account to start your watchlist.',
      });
      return;
    }
    watchMutation.mutate({ listingId, next });
  };

  // Save search — backend collection is a follow-up. For now we toast and
  // (if signed in) drop them on the watchlist page.
  const onSaveSearch = () => {
    if (!user) {
      toast({
        title: 'Sign in to save searches',
        description: 'Create a free account to get alerts when new listings match.',
      });
      return;
    }
    toast({
      title: 'Saved searches coming soon',
      description: 'We\'ll alert you here once new listings match these filters.',
    });
  };

  // Infinite-scroll sentinel.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          listQuery.hasNextPage &&
          !listQuery.isFetchingNextPage
        ) {
          listQuery.fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [listQuery]);

  const heading =
    listingType === 'rent' ? 'Properties for rent' : 'Properties for sale';

  // Mobile shows either list OR map; desktop always shows both.
  const showList = view === 'list';
  const showMap = view === 'map';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Pill filter bar (desktop full row, mobile horizontal scroll) */}
      <div className="border-b border-sectionBorder bg-card/80 px-3 py-3 backdrop-blur md:px-5">
        <FilterPillBar
          listingType={listingType}
          filters={filters}
          onChange={updateFilters}
          onSaveSearch={onSaveSearch}
        />
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* LIST COLUMN */}
        <section
          className={`${showList ? 'flex' : 'hidden md:flex'} h-full min-h-0 flex-col`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-heading font-bold tracking-tight md:text-xl">
                {heading}
                {filters.state ? `: ${filters.state}` : ''}
              </h1>
              <p className="text-xs text-muted-foreground">
                {listQuery.isLoading ? '—' : `${total} results`}
                {listingType === 'rent' && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => updateFilters({})}
                      className="text-primary hover:underline"
                    >
                      Switch to sale
                    </button>
                  </>
                )}
              </p>
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price-asc">Price low → high</SelectItem>
                <SelectItem value="price-desc">Price high → low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-6 md:px-5">
            {listQuery.isLoading ? (
              <ListSkeleton />
            ) : listItems.length === 0 ? (
              <EmptyState onReset={() => updateFilters({})} />
            ) : (
              <>
                {listItems.map((listing) => (
                  <ListingRow
                    key={listing._id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(listing._id, el);
                      else rowRefs.current.delete(listing._id);
                    }}
                    listing={listing}
                    hovered={hoveredId === listing._id}
                    focused={focusedId === listing._id}
                    onHover={setHoveredId}
                    onToggleWatch={onToggleWatch}
                    isWatched={listing.inWatchlist}
                  />
                ))}
                <div ref={sentinelRef} className="h-8" />
                {listQuery.isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more…
                  </div>
                )}
                {!listQuery.hasNextPage && listItems.length >= PAGE_SIZE && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    You&apos;ve reached the end.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* MAP COLUMN */}
        <section
          className={`${showMap ? 'block' : 'hidden md:block'} relative h-full`}
        >
          <ListingMap
            listings={mapMarkers}
            hoveredId={hoveredId}
            focusedId={focusedId}
            onHover={setHoverFromMap}
            onSelect={setFocusedId}
            onIdle={handleMapIdle}
            initialBbox={initialBbox}
          >
            <DrawTool polygonString={polygonParam} onPolygonChange={setPolygon} />
          </ListingMap>
          <SearchAsIMoveToggle
            checked={samiOn}
            onChange={setSami}
            isFetching={mapQuery.isFetching || listQuery.isFetching}
          />
        </section>
      </div>

      <BrowseMobileToggle view={view} onChange={setView} />
    </div>
  );
}

function parseBbox(raw) {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [swLng, swLat, neLng, neLat] = parts;
  return { swLng, swLat, neLng, neLat };
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-40 gap-3 rounded-2xl border border-sectionBorder bg-card p-3"
        >
          <div className="h-full w-56 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-auto h-5 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="rounded-2xl border border-dashed border-sectionBorder p-12 text-center text-muted-foreground">
      <p>No listings match your filters yet.</p>
      <Button variant="outline" size="sm" onClick={onReset} className="mt-3">
        Reset filters
      </Button>
    </div>
  );
}
