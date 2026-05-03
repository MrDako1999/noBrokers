import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, CalendarX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { SUPPORTED_TIMEZONES, WEEKDAY_LABELS } from '@/lib/constants';
import { formatDateTime, formatMinuteOfDay, parseMinuteOfDay } from '@/lib/format';

const DEFAULT_SLOT_LENGTH = 30;
const DEFAULT_BUFFER = 0;

// Shape of a row in the local editor state. Kept minimal — we serialize
// to the server's rule shape on save.
// { weekday: number, start: '09:00', end: '17:00', slotLengthMin, bufferMin }
function newRow(weekday) {
  return {
    id: `${weekday}-${Math.random().toString(36).slice(2, 8)}`,
    weekday,
    start: '09:00',
    end: '17:00',
    slotLengthMin: DEFAULT_SLOT_LENGTH,
    bufferMin: DEFAULT_BUFFER,
  };
}

function fromRule(rule) {
  return {
    id: `${rule.weekday}-${rule._id || Math.random().toString(36).slice(2, 8)}`,
    weekday: rule.weekday,
    start: formatMinuteOfDay(rule.startMinute),
    end: formatMinuteOfDay(rule.endMinute),
    slotLengthMin: rule.slotLengthMin || DEFAULT_SLOT_LENGTH,
    bufferMin: rule.bufferMin || DEFAULT_BUFFER,
  };
}

export default function AvailabilityTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [timezone, setTimezone] = useState('Asia/Kuala_Lumpur');

  const { data, isLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: async () => (await api.get('/owners/me/availability')).data,
  });

  // Re-seed local state when the server payload arrives or changes.
  useEffect(() => {
    if (!data) return;
    setTimezone(data.defaults?.timezone || data.rules?.[0]?.timezone || 'Asia/Kuala_Lumpur');
    setRows(data.rules?.map(fromRule) || []);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        timezone,
        rules: rows
          .map((r) => ({
            weekday: r.weekday,
            startMinute: parseMinuteOfDay(r.start),
            endMinute: parseMinuteOfDay(r.end),
            slotLengthMin: Number(r.slotLengthMin) || DEFAULT_SLOT_LENGTH,
            bufferMin: Number(r.bufferMin) || 0,
            timezone,
          }))
          .filter(
            (r) =>
              r.startMinute != null &&
              r.endMinute != null &&
              r.endMinute - r.startMinute >= 15,
          ),
      };
      return (await api.put('/owners/me/availability', payload)).data;
    },
    onSuccess: () => {
      toast({ title: 'Availability saved' });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: err.response?.data?.error || 'Please try again.',
      });
    },
  });

  const addRow = (weekday) => setRows((prev) => [...prev, newRow(weekday)]);
  const updateRow = (id, patch) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Set the weekly hours when buyers can request a viewing. They&apos;ll only see slots
        inside these windows; you still accept or reschedule every request.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Applies to every slot unless overridden on a rule.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>
            Add one or more time windows per day. Leave a day empty to block it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            WEEKDAY_LABELS.map((day) => {
              const dayRows = rows.filter((r) => r.weekday === day.value);
              return (
                <div key={day.value} className="grid gap-3 sm:grid-cols-[120px_1fr] items-start">
                  <div className="pt-2 font-semibold text-sm">{day.long}</div>
                  <div className="space-y-2">
                    {dayRows.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => addRow(day.value)}
                        className="w-full rounded-lg border border-dashed border-sectionBorder px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add window
                      </button>
                    ) : (
                      dayRows.map((row) => (
                        <RuleRow
                          key={row.id}
                          row={row}
                          onChange={(patch) => updateRow(row.id, patch)}
                          onRemove={() => removeRow(row.id)}
                        />
                      ))
                    )}
                    {dayRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => addRow(day.value)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add another
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Save changes
        </Button>
      </div>

      <ExceptionsCard exceptions={data?.exceptions} />
    </div>
  );
}

function RuleRow({ row, onChange, onRemove }) {
  return (
    <div className="grid gap-2 rounded-lg border border-sectionBorder bg-card p-3 sm:grid-cols-[1fr_1fr_120px_120px_40px]">
      <div className="space-y-1">
        <Label className="text-xs">Start</Label>
        <Input
          type="time"
          value={row.start}
          onChange={(e) => onChange({ start: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">End</Label>
        <Input type="time" value={row.end} onChange={(e) => onChange({ end: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Slot (min)</Label>
        <Input
          type="number"
          min={15}
          max={240}
          step={15}
          value={row.slotLengthMin}
          onChange={(e) => onChange({ slotLengthMin: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Buffer (min)</Label>
        <Input
          type="number"
          min={0}
          max={120}
          step={5}
          value={row.bufferMin}
          onChange={(e) => onChange({ bufferMin: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-end justify-center sm:justify-end pt-2 sm:pt-0">
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove window">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function ExceptionsCard({ exceptions }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: 'block',
    startAt: '',
    endAt: '',
    reason: '',
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.startAt || !form.endAt) throw new Error('Pick a start and end time');
      return (
        await api.post('/owners/me/availability/exceptions', {
          kind: form.kind,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          reason: form.reason,
        })
      ).data;
    },
    onSuccess: () => {
      toast({ title: 'Exception added' });
      setOpen(false);
      setForm({ kind: 'block', startAt: '', endAt: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not add exception',
        description: err.response?.data?.error || err.message,
      });
    },
  });

  const remove = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/owners/me/availability/exceptions/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>One-off exceptions</CardTitle>
            <CardDescription>
              Block a holiday, travel, or open an extra window outside your weekly schedule.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="rounded-lg border border-sectionBorder p-3 space-y-3 bg-card">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr]">
              <div className="space-y-1">
                <Label className="text-xs">Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="open">Open extra window</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason (optional)</Label>
              <Input
                maxLength={200}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Travel, renovation, one-off open-house..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
                {add.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}

        {!exceptions?.length ? (
          <div className="py-6 text-center text-sm text-muted-foreground inline-flex items-center gap-1.5 justify-center w-full">
            <CalendarX2 className="h-4 w-4" />
            No upcoming exceptions.
          </div>
        ) : (
          <ul className="divide-y divide-sectionBorder">
            {exceptions.map((ex) => (
              <li key={ex._id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium capitalize">
                    {ex.kind === 'block' ? 'Blocked' : 'Open window'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(ex.startAt)} — {formatDateTime(ex.endAt)}
                    {ex.reason ? ` · ${ex.reason}` : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(ex._id)}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
