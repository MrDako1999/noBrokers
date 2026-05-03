import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// Two-pane slot picker:
//   left  = list of upcoming days (next 14 by default)
//   right = bookable time slots for the selected day
// Works for both the listing-detail booking modal and future re-proposal UIs.
//
// Props:
//   listingId: string
//   windowDays?: number       (default 14, max 30 matches server cap)
//   selected?: { startAt, endAt }
//   onSelect(slot)
//   showEmpty?: boolean       (render "no slots" state instead of hiding)
export default function SlotPicker({
  listingId,
  windowDays = 14,
  selected,
  onSelect,
  showEmpty = true,
}) {
  const [offsetDays, setOffsetDays] = useState(0);

  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const f = new Date(start.getTime() + offsetDays * 86400000);
    const t = new Date(f.getTime() + windowDays * 86400000);
    return { from: f.toISOString(), to: t.toISOString() };
  }, [offsetDays, windowDays]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['slots', listingId, from, to],
    queryFn: async () =>
      (
        await api.get(`/listings/${listingId}/slots`, {
          params: { from, to },
        })
      ).data,
    enabled: !!listingId,
    staleTime: 60_000,
  });

  const timezone = data?.timezone || 'Asia/Kuala_Lumpur';

  // Group slots by zoned-local day so the UI panes line up with how buyers
  // actually think about a day (not how UTC slices things).
  const byDay = useMemo(() => {
    if (!data?.slots?.length) return [];
    const groups = new Map();
    for (const s of data.slots) {
      const start = new Date(s.startAt);
      const key = start.toLocaleDateString('en-CA', { timeZone: timezone });
      if (!groups.has(key)) groups.set(key, { key, slots: [], date: start });
      groups.get(key).slots.push(s);
    }
    return Array.from(groups.values()).sort((a, b) => a.date - b.date);
  }, [data, timezone]);

  const [selectedDay, setSelectedDay] = useState(null);
  const activeDayKey = selectedDay || byDay[0]?.key || null;
  const activeDay = byDay.find((d) => d.key === activeDayKey) || byDay[0];

  const isSelected = (slot) =>
    selected && new Date(selected.startAt).getTime() === new Date(slot.startAt).getTime();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-sectionBorder p-6 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading available slots...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Shown in owner&apos;s timezone ({timezone})
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={offsetDays === 0}
            onClick={() => setOffsetDays((v) => Math.max(0, v - windowDays))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffsetDays((v) => v + windowDays)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {byDay.length === 0 ? (
        showEmpty ? (
          <div className="rounded-xl border border-dashed border-sectionBorder p-6 text-center text-sm text-muted-foreground">
            The owner has no open slots in this window.
            {offsetDays === 0 && ' Try looking further ahead.'}
          </div>
        ) : null
      ) : (
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:max-h-80 md:overflow-y-auto">
            {byDay.map((d) => {
              const active = d.key === activeDayKey;
              const label = d.date.toLocaleDateString('en-MY', {
                timeZone: timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              return (
                <li key={d.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(d.key)}
                    className={cn(
                      'whitespace-nowrap rounded-lg border px-3 py-2 text-left text-sm transition-colors w-full',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-sectionBorder hover:bg-accent',
                    )}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.slots.length} slot{d.slots.length === 1 ? '' : 's'}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:max-h-80 md:overflow-y-auto pr-1">
            {activeDay?.slots?.map((slot) => {
              const start = new Date(slot.startAt);
              const timeLabel = start.toLocaleTimeString('en-MY', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
              });
              const active = isSelected(slot);
              return (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => onSelect?.(slot)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-sectionBorder hover:border-primary hover:bg-accent',
                  )}
                >
                  {timeLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isFetching && !isLoading && (
        <div className="text-[11px] text-muted-foreground">Refreshing...</div>
      )}
    </div>
  );
}
