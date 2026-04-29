import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ListingForm from '@/components/ListingForm';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => (await api.get(`/listings/${id}`)).data,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => (await api.put(`/listings/${id}`, payload)).data.listing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      toast({ title: 'Listing saved' });
      navigate('/dashboard/listings');
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not save listing',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  if (isLoading || !data) {
    return <div className="h-[400px] rounded-2xl bg-muted animate-pulse" />;
  }

  const initial = {
    ...data.listing,
    price: data.listing.price ?? '',
    monthlyRent: data.listing.monthlyRent ?? '',
    bedrooms: data.listing.bedrooms ?? '',
    bathrooms: data.listing.bathrooms ?? '',
    parkingSpaces: data.listing.parkingSpaces ?? '',
    sqft: data.listing.sqft ?? '',
    ownershipDocuments: data.listing.verification?.documents || [],
    location: {
      ...data.listing.location,
      lat: data.listing.location?.geo?.coordinates?.[1] ?? '',
      lng: data.listing.location?.geo?.coordinates?.[0] ?? '',
    },
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Edit listing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Major edits will send the listing back into the verification queue.
        </p>
      </div>
      <ListingForm
        initial={initial}
        onSubmit={(payload) => mutation.mutate(payload)}
        submitting={mutation.isPending}
        mode="edit"
      />
    </div>
  );
}
