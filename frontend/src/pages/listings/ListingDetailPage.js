import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bed,
  Bath,
  Maximize2,
  Car,
  MapPin,
  ShieldCheck,
  Heart,
  Loader2,
  Calendar,
  Tag,
  Sofa,
  CheckCircle2,
  CalendarClock,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice, formatRent, formatPsf, timeAgo } from '@/lib/format';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import { LISTING_STATUS_LABELS } from '@/lib/constants';
import SlotPicker from '@/components/SlotPicker';
import useChatStore from '@/stores/chatStore';

export default function ListingDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const openChatForListing = useChatStore((s) => s.openForListing);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [chatOpening, setChatOpening] = useState(false);

  const handleOpenChat = async () => {
    if (!user) {
      const next = encodeURIComponent(`/listings/${id}`);
      navigate(`/login?next=${next}`);
      return;
    }
    setChatOpening(true);
    try {
      await openChatForListing(id);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not open chat',
        description: err.response?.data?.error || 'Please try again.',
      });
    } finally {
      setChatOpening(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data } = await api.get(`/listings/${id}`);
      return data;
    },
  });

  useEffect(() => {
    if (data?.listing?.title) document.title = `${data.listing.title} — noBrokers.my`;
  }, [data]);

  const watchMutation = useMutation({
    mutationFn: async (next) => {
      if (next) await api.post(`/watchlist/${id}`);
      else await api.delete(`/watchlist/${id}`);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['listing', id], (prev) => prev && { ...prev, inWatchlist: next });
    },
  });

  const offerMutation = useMutation({
    mutationFn: async ({ amount, message }) => {
      const { data } = await api.post('/offers', { listingId: id, amount, message });
      return data.offer;
    },
    onSuccess: (offer) => {
      setOfferOpen(false);
      toast({ title: 'Offer sent', description: 'You can track the conversation in your dashboard.' });
      navigate(`/dashboard/offers/${offer._id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not send offer',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  const viewingMutation = useMutation({
    mutationFn: async ({ slot, mode, notes }) => {
      const { data } = await api.post('/viewings', {
        listingId: id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        mode,
        notes,
      });
      return data.viewing;
    },
    onSuccess: (viewing) => {
      setViewingOpen(false);
      toast({
        title: 'Viewing requested',
        description: 'The owner will accept, reschedule or decline shortly.',
      });
      navigate(`/dashboard/viewings/${viewing._id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not request viewing',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
          <div className="h-[400px] rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data?.listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-heading font-bold">Listing not found</h1>
        <p className="text-muted-foreground mt-2">It may have been removed or is not yet active.</p>
        <Button asChild className="mt-6"><Link to="/buy">Browse listings</Link></Button>
      </div>
    );
  }

  const listing = data.listing;
  const isSale = listing.listingType === 'sale';
  const price = isSale ? formatPrice(listing.price) : formatRent(listing.monthlyRent);
  const psf = isSale ? formatPsf(listing.price, listing.sqft) : null;
  const ownerVerified = listing.owner?.kyc?.status === 'verified';
  const isOwner = user && listing.owner?._id === user._id;
  const cover = listing.images?.[activeImage]?.url;

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
      {listing.status !== 'active' && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning-bg px-4 py-2.5 text-sm text-warning">
          This listing is currently <strong>{LISTING_STATUS_LABELS[listing.status]}</strong> and is only visible to you.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-sectionBorder bg-muted aspect-[4/3]">
            {cover ? (
              <img src={cover} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">No photo</div>
            )}
          </div>
          {listing.images?.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {listing.images.map((img, idx) => (
                <button
                  key={img.key || idx}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`overflow-hidden rounded-lg border-2 ${
                    idx === activeImage ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt="" className="aspect-[4/3] h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={isSale ? 'default' : 'info'}>{isSale ? 'For Sale' : 'For Rent'}</Badge>
              {ownerVerified && (
                <Badge variant="success">
                  <ShieldCheck className="h-3 w-3" /> Verified owner
                </Badge>
              )}
              {listing.verification?.verified && (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" /> Ownership verified
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">{listing.title}</h1>
            <p className="mt-1 text-muted-foreground inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[listing.location?.address, listing.location?.city, listing.location?.state, listing.location?.postcode]
                .filter(Boolean)
                .join(', ')}
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Bed} label="Bedrooms" value={listing.bedrooms || '—'} />
              <Stat icon={Bath} label="Bathrooms" value={listing.bathrooms || '—'} />
              <Stat icon={Maximize2} label="Built-up" value={listing.sqft ? `${listing.sqft} sqft` : '—'} />
              <Stat icon={Car} label="Parking" value={listing.parkingSpaces || '—'} />
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold font-heading mb-2">About this property</h2>
              <p className="text-sm text-foreground/85 whitespace-pre-line">
                {listing.description || 'The owner has not added a description yet.'}
              </p>
            </div>

            {listing.amenities?.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold font-heading mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a) => (
                    <span key={a} className="rounded-full border border-sectionBorder px-3 py-1 text-xs">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Detail label="Property type" value={listing.propertyType?.replace(/_/g, ' ')} icon={Tag} />
              <Detail label="Furnishing" value={listing.furnished?.replace(/_/g, ' ')} icon={Sofa} />
              <Detail label="Listed" value={timeAgo(listing.createdAt)} icon={Calendar} />
              <Detail label="Views" value={listing.views || 0} icon={Heart} />
            </div>
          </div>
        </div>

        <aside className="md:sticky md:top-20 md:self-start">
          <div className="rounded-2xl border border-sectionBorder bg-card p-6 space-y-4">
            <div>
              <div className="text-3xl font-heading font-bold">{price}</div>
              {psf && <div className="text-sm text-muted-foreground">{psf}</div>}
            </div>

            <div className="flex flex-col gap-2">
              {isOwner ? (
                <Button asChild>
                  <Link to={`/dashboard/listings/${listing._id}/edit`}>Edit listing</Link>
                </Button>
              ) : (
                <>
                  {user ? (
                    <>
                      <Button
                        size="lg"
                        onClick={handleOpenChat}
                        disabled={chatOpening}
                      >
                        {chatOpening ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4 mr-1.5" />
                        )}
                        Chat with owner
                      </Button>
                      <Dialog open={viewingOpen} onOpenChange={setViewingOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="lg" disabled={listing.status !== 'active'}>
                            <CalendarClock className="h-4 w-4 mr-1.5" />
                            Request a viewing
                          </Button>
                        </DialogTrigger>
                        <ViewingDialog
                          listingId={listing._id}
                          submitting={viewingMutation.isPending}
                          onSubmit={(values) => viewingMutation.mutate(values)}
                        />
                      </Dialog>
                      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="lg" disabled={listing.status !== 'active'}>
                            Make an offer
                          </Button>
                        </DialogTrigger>
                        <OfferDialog
                          listing={listing}
                          submitting={offerMutation.isPending}
                          onSubmit={(values) => offerMutation.mutate(values)}
                        />
                      </Dialog>
                    </>
                  ) : (
                    <>
                      <Button size="lg" onClick={handleOpenChat}>
                        <MessageCircle className="h-4 w-4 mr-1.5" />
                        Chat with owner
                      </Button>
                      <Button asChild variant="outline" size="lg">
                        <Link to="/login">Sign in to book a viewing</Link>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!user) {
                        toast({ title: 'Sign in to save listings' });
                        return;
                      }
                      watchMutation.mutate(!data.inWatchlist);
                    }}
                  >
                    <Heart className={`h-4 w-4 mr-1.5 ${data.inWatchlist ? 'fill-destructive text-destructive' : ''}`} />
                    {data.inWatchlist ? 'Saved' : 'Save to watchlist'}
                  </Button>
                </>
              )}
            </div>

            <div className="border-t border-sectionBorder pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Listed by
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-semibold">
                  {listing.owner?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm">{listing.owner?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Member since {new Date(listing.owner?.createdAt).getFullYear()}
                  </div>
                </div>
              </div>
              {ownerVerified && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  KYC verified
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-sectionBorder bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 capitalize">{value || '—'}</div>
    </div>
  );
}

function ViewingDialog({ listingId, submitting, onSubmit }) {
  const [slot, setSlot] = useState(null);
  const [mode, setMode] = useState('in_person');
  const [notes, setNotes] = useState('');

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Request a viewing</DialogTitle>
        <DialogDescription>
          Pick a time from the owner&apos;s open availability. They&apos;ll confirm or reschedule.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!slot) return;
          onSubmit({ slot, mode, notes });
        }}
        className="space-y-4"
      >
        <SlotPicker listingId={listingId} selected={slot} onSelect={setSlot} />

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="virtual">Virtual tour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Note to owner (optional)</Label>
            <Input
              id="notes"
              maxLength={500}
              placeholder="Mention anything the owner should know before the viewing."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={submitting || !slot}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function OfferDialog({ listing, submitting, onSubmit }) {
  const isSale = listing.listingType === 'sale';
  const asking = isSale ? listing.price : listing.monthlyRent;
  const [amount, setAmount] = useState(asking || '');
  const [message, setMessage] = useState('');

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Make an offer</DialogTitle>
        <DialogDescription>
          The owner will see your offer and can accept, counter, or reject. Asking price is{' '}
          <strong>{isSale ? formatPrice(asking) : formatRent(asking)}</strong>.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ amount: Number(amount), message });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="amount">Your offer ({isSale ? 'RM' : 'RM/month'})</Label>
          <Input
            id="amount"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Note to the owner (optional)</Label>
          <Textarea
            id="message"
            rows={3}
            placeholder="Tell the owner why this offer makes sense, when you can move in, etc."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !amount}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Send offer
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
