import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ListingCard from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => (await api.get('/watchlist')).data.items,
  });

  const removeMutation = useMutation({
    mutationFn: (listingId) => api.delete(`/watchlist/${listingId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Properties you&apos;re keeping an eye on. We&apos;ll add price-drop alerts soon.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-sectionBorder p-12 text-center text-muted-foreground">
          Nothing saved yet. <Link to="/buy" className="text-primary hover:underline font-medium">Browse listings</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map(({ listing }) => (
            <div key={listing._id} className="space-y-2">
              <ListingCard
                listing={listing}
                isWatched
                onToggleWatch={(id) => removeMutation.mutate(id)}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => removeMutation.mutate(listing._id)}
              >
                Remove from watchlist
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
