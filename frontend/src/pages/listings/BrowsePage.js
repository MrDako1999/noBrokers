import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ListingCard from '@/components/ListingCard';
import SearchFilters from '@/components/SearchFilters';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';

// Single browse page reused for both `for-sale` (/buy) and `for-rent` (/rent).
// The route component just passes `listingType` so we keep the file count down.
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

  // Read filters from the URL on every render. The form pushes back into
  // the URL on submit, which re-runs the query through React Router.
  const filters = useMemo(() => {
    const obj = {};
    for (const [k, v] of searchParams.entries()) obj[k] = v;
    return obj;
  }, [searchParams]);

  const sort = filters.sort || 'newest';
  const page = parseInt(filters.page || '1', 10);

  const queryKey = ['listings', listingType, filters];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = { listingType, ...filters, page, limit: 24 };
      const { data } = await api.get('/listings', { params });
      return data;
    },
    keepPreviousData: true,
  });

  const watchMutation = useMutation({
    mutationFn: async ({ listingId, next }) => {
      if (next) await api.post(`/watchlist/${listingId}`);
      else await api.delete(`/watchlist/${listingId}`);
      return { listingId, next };
    },
    onSuccess: ({ listingId, next }) => {
      queryClient.setQueryData(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) => (i._id === listingId ? { ...i, inWatchlist: next } : i)),
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

  const update = (next) => {
    const merged = { ...filters, ...next, page: 1 };
    Object.keys(merged).forEach((k) => {
      if (merged[k] === '' || merged[k] == null) delete merged[k];
    });
    setSearchParams(merged);
  };

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

  const totalPages = data?.totalPages || 1;
  const heading =
    listingType === 'rent' ? 'Properties for rent' : 'Properties for sale';

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total ?? '—'} listings · owner-direct, verified
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline text-sm text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="price-asc">Price low → high</SelectItem>
              <SelectItem value="price-desc">Price high → low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6">
        <SearchFilters value={filters} onChange={update} listingType={listingType} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : data?.items?.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((listing) => (
              <ListingCard
                key={listing._id}
                listing={listing}
                onToggleWatch={onToggleWatch}
                isWatched={listing.inWatchlist}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setSearchParams({ ...filters, page: String(page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setSearchParams({ ...filters, page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-sectionBorder p-12 text-center text-muted-foreground">
          No listings match your filters yet. Try widening the search.
        </div>
      )}
    </div>
  );
}
