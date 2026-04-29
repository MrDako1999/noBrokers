import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Home, ShieldCheck, Clock } from 'lucide-react';
import api from '@/lib/api';

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
  });

  const items = [
    { icon: Users, label: 'Total users', value: data?.users, href: '/admin/users' },
    { icon: Clock, label: 'KYC pending', value: data?.pendingKyc, href: '/admin/users?status=pending' },
    { icon: Home, label: 'Listings pending', value: data?.pendingListings, href: '/admin/listings?status=pending' },
    { icon: ShieldCheck, label: 'Active listings', value: data?.activeListings, href: '/admin/listings?status=active' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Admin overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Verification queues and platform stats.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.href}
            className="rounded-2xl border border-sectionBorder bg-card p-5 hover:border-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <it.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</div>
                <div className="text-2xl font-heading font-bold">
                  {isLoading ? '—' : it.value ?? 0}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
