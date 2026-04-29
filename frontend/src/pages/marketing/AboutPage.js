import { useEffect } from 'react';
import { ShieldCheck, Wallet, Users, MessageSquare } from 'lucide-react';

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About — noBrokers.my';
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-12 md:py-16">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</span>
      <h1 className="mt-2 text-3xl md:text-4xl font-heading font-bold tracking-tight">
        Why noBrokers.my exists.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Real estate agents in Malaysia have a long-standing reputation problem. Inflated commissions,
        gatekept listings, and the same WhatsApp blast forwarded between ten agents — none of which adds
        value to the actual deal between an owner and a buyer or tenant.
      </p>

      <p className="mt-4 text-muted-foreground">
        noBrokers.my puts the owner and the buyer in the same room. We do the work an agent <em>should</em>
        be doing — verifying ownership, vetting buyers and tenants, structuring offers, generating offer
        and tenancy agreement drafts — without taking a cut of the deal.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {[
          {
            icon: ShieldCheck,
            title: 'Verified ownership',
            body: 'Owners upload title docs / SPA / quit rent. Our admin reviews within 48 hours.',
          },
          {
            icon: Users,
            title: 'KYC for buyers and tenants',
            body: 'Identity check on every offer-maker. (MyDigitalID integration coming soon.)',
          },
          {
            icon: MessageSquare,
            title: 'Direct negotiation',
            body: 'Make an offer, counter, accept — one thread, no broker in the middle.',
          },
          {
            icon: Wallet,
            title: 'No commission',
            body: 'Free to list and free to make offers. We charge for premium add-ons later.',
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-sectionBorder bg-card p-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-semibold font-heading">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
