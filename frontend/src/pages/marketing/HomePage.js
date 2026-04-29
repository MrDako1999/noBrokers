import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, Wallet, MessageSquare, ArrowRight, Home as HomeIcon, Building2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ListingCard from '@/components/ListingCard';
import api from '@/lib/api';

export default function HomePage() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('sale');
  const [query, setQuery] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    const path = intent === 'rent' ? '/rent' : '/buy';
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    navigate(`${path}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const featured = useQuery({
    queryKey: ['featured-listings'],
    queryFn: async () => {
      const { data } = await api.get('/listings', { params: { limit: 6 } });
      return data.items;
    },
  });

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hero-gradient text-white">
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-24">
            <div className="max-w-3xl">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide uppercase">
                Owner-direct · Malaysia
              </span>
              <h1 className="mt-4 text-4xl md:text-6xl font-heading font-bold tracking-tight">
                Property without the broker tax.
              </h1>
              <p className="mt-4 text-lg md:text-xl text-white/85 max-w-2xl">
                Owners list. Buyers and tenants deal direct. We handle the
                paperwork, verification and offers — you keep the commission.
              </p>

              <form onSubmit={onSearch} className="mt-8 grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 max-w-2xl rounded-2xl bg-white p-2 shadow-xl">
                <Select value={intent} onValueChange={setIntent}>
                  <SelectTrigger className="border-transparent bg-secondary/40 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Buy</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  icon={Search}
                  placeholder="Mont Kiara, Bangsar South, Penang…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 bg-transparent border-transparent text-foreground"
                />
                <Button type="submit" size="lg" className="h-12">
                  Search
                </Button>
              </form>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Verified owners
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  No commission
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Direct negotiation
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Verified ownership',
              body: 'Every listing is checked against title docs by our admin team before it goes live. KYC for buyers and tenants too — so the person on the other side is real.',
            },
            {
              icon: Wallet,
              title: 'Keep the commission',
              body: "No 2-3% sales commission, no one-month rental fee. The savings stay in the owner's and buyer's pockets.",
            },
            {
              icon: MessageSquare,
              title: 'Negotiate directly',
              body: 'Make an offer, counter, accept — all in one thread. No agent playing phone tag between you and the other side.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-sectionBorder bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold font-heading">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Featured</span>
            <h2 className="mt-1 text-2xl md:text-3xl font-heading font-bold">Latest listings</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/buy">
              See all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        {featured.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : featured.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.data.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-sectionBorder p-10 text-center text-muted-foreground">
            No listings yet — be the first.{' '}
            <Link to="/dashboard/listings/new" className="text-primary hover:underline font-medium">
              List your property
            </Link>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">For owners</span>
            <h2 className="mt-1 text-3xl md:text-4xl font-heading font-bold">List in minutes. Sell or rent without the middleman.</h2>
            <p className="mt-4 text-muted-foreground max-w-prose">
              Upload your title deed, set your price, add your photos. Our admin team verifies your ownership in under
              48 hours and your listing goes live to verified buyers and tenants. You take every offer directly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard/listings/new">
                  <Tag className="h-4 w-4 mr-1.5" />
                  List a property
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/about">How it works</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: HomeIcon, label: 'Residential' },
              { icon: Building2, label: 'Commercial' },
              { icon: Tag, label: 'Land' },
              { icon: ShieldCheck, label: 'Verified' },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-sectionBorder bg-card p-6 text-center">
                <c.icon className="mx-auto h-8 w-8 text-primary" />
                <div className="mt-2 text-sm font-medium">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
