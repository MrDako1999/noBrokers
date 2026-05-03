import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Clock4 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import { VIEWING_STATUS_LABELS, VIEWING_STATUS_VARIANTS } from '@/lib/constants';
import { formatInZone } from '@/lib/format';
import { cn } from '@/lib/utils';

// Week-at-a-glance agenda for the seller. Picks the owner's own timezone
// to lay out days. Future: swap the agenda for a time-grid view.
const RELEVANT = ['requested', 'counter_proposed', 'accepted'];

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['viewings', 'owner', 'calendar'],
    queryFn: async () =>
      (await api.get('/viewings/mine', { params: { side: 'owner' } })).data.items,
    refetchInterval: 60_000,
  });

  const availability = useQuery({
    queryKey: ['availability'],
    queryFn: async () => (await api.get('/owners/me/availability')).data,
  });

  const tz = availability.data?.defaults?.timezone || 'Asia/Kuala_Lumpur';

  const { weekStart, weekEnd, days } = useMemo(() => {
    const now = new Date();
    // Start-of-week in owner's tz. We use Monday-based weeks.
    const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const dow = (local.getDay() + 6) % 7; // Monday=0
    const monday = new Date(local);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(local.getDate() - dow + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const list = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return { weekStart: monday, weekEnd: sunday, days: list };
  }, [weekOffset, tz]);

  const eventsByDay = useMemo(() => {
    if (!data) return {};
    const map = {};
    for (const v of data) {
      if (!RELEVANT.includes(v.status)) continue;
      const start = new Date(v.startAt);
      if (start < weekStart || start > weekEnd) continue;
      const key = start.toLocaleDateString('en-CA', { timeZone: tz });
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    }
    return map;
  }, [data, tz, weekStart, weekEnd]);

  const weekLabel = `${weekStart.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', timeZone: tz })} – ${weekEnd.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', timeZone: tz })}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight inline-flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Week of <span className="font-medium text-foreground">{weekLabel}</span> · {tz}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((v) => v - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((v) => v + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button asChild size="sm">
            <Link to="/dashboard/seller/availability">
              <Clock4 className="h-4 w-4 mr-1.5" />
              Availability
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading viewings...</Card>
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const key = day.toLocaleDateString('en-CA', { timeZone: tz });
            const list = eventsByDay[key] || [];
            const isToday =
              new Date().toLocaleDateString('en-CA', { timeZone: tz }) === key;
            return (
              <Card key={key} className={cn(isToday && 'ring-1 ring-primary')}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {day.toLocaleDateString('en-MY', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      timeZone: tz,
                    })}
                    {isToday && (
                      <Badge variant="default" className="ml-2 text-[10px]">
                        Today
                      </Badge>
                    )}
                  </CardTitle>
                  {list.length === 0 && (
                    <CardDescription className="text-xs">No viewings.</CardDescription>
                  )}
                </CardHeader>
                {list.length > 0 && (
                  <CardContent className="space-y-2">
                    {list.map((v) => (
                      <Link
                        key={v._id}
                        to={`/dashboard/viewings/${v._id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-sectionBorder px-3 py-2 hover:border-primary transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {formatInZone(v.startAt, tz)} · {v.listing?.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            with {v.buyer?.name || 'buyer'} · {v.mode === 'virtual' ? 'virtual' : 'in person'}
                          </div>
                        </div>
                        <Badge variant={VIEWING_STATUS_VARIANTS[v.status] || 'outline'}>
                          {VIEWING_STATUS_LABELS[v.status]}
                        </Badge>
                      </Link>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
