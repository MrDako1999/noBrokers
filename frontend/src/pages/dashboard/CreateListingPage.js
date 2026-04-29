import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ListingForm from '@/components/ListingForm';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function CreateListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (payload) => (await api.post('/listings', payload)).data.listing,
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      toast({
        title: listing.status === 'pending' ? 'Submitted for verification' : 'Draft saved',
        description:
          listing.status === 'pending'
            ? 'Our admin will review your ownership documents within 48 hours.'
            : 'You can come back and finish this listing any time.',
      });
      navigate('/dashboard/listings');
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not create listing',
        description: err.response?.data?.error || 'Please check the form and try again.',
      });
    },
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">List a property</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about the property and add a few photos. Submit for verification when you&apos;re ready.
        </p>
      </div>
      <ListingForm onSubmit={(payload) => mutation.mutate(payload)} submitting={mutation.isPending} mode="create" />
    </div>
  );
}
