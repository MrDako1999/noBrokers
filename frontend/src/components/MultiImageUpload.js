import { useState } from 'react';
import { Loader2, Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFile, deleteUpload } from '@/lib/uploads';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Drag-and-drop image grid for the listing form. The first image is the
// cover. Files are uploaded to R2 immediately on selection so the user
// gets a real preview (and we can delete on remove without a save).
export default function MultiImageUpload({ value = [], onChange, kind = 'listing-image', maxImages = 12 }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const onSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    if (!files.length) return;

    if (value.length + files.length > maxImages) {
      toast({ variant: 'destructive', title: `Maximum ${maxImages} images` });
      return;
    }

    setBusy(true);
    const uploaded = [];
    try {
      for (const file of files) {
        const { url, key } = await uploadFile(file, kind);
        uploaded.push({ url, key });
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (idx) => {
    const removed = value[idx];
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    if (removed?.key) {
      deleteUpload(removed.key).catch(() => {});
    }
  };

  // Light drag-to-reorder. We don't bother with a real DnD lib for the MVP.
  const onMove = (from, to) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {value.map((img, idx) => (
          <div
            key={img.key || idx}
            className="group relative aspect-square overflow-hidden rounded-xl border border-sectionBorder bg-muted"
          >
            <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {idx === 0 && (
              <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white"
                onClick={() => onMove(idx, idx - 1)}
                aria-label="Move left"
              >
                <GripVertical className="h-3.5 w-3.5 -rotate-90" />
              </button>
            </div>
          </div>
        ))}

        {value.length < maxImages && (
          <label
            className={cn(
              'group flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sectionBorder bg-muted/30 transition-colors hover:border-primary hover:bg-muted',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            )}
            <span className="text-xs text-muted-foreground">Add photos</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={onSelect} />
          </label>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Up to {maxImages} images, max 15MB each. JPG, PNG, WEBP, AVIF, HEIC. The first image is the cover.
      </p>
    </div>
  );
}

// Variant for KYC / ownership docs — accepts PDFs as well as images.
export function MultiDocumentUpload({ value = [], onChange, kind, types, maxFiles = 6 }) {
  const [busy, setBusy] = useState(false);
  const [pickedType, setPickedType] = useState(types?.[0]?.value || 'other');
  const { toast } = useToast();

  const onSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (value.length + files.length > maxFiles) {
      toast({ variant: 'destructive', title: `Maximum ${maxFiles} documents` });
      return;
    }

    setBusy(true);
    const uploaded = [];
    try {
      for (const file of files) {
        const { url, key } = await uploadFile(file, kind);
        uploaded.push({ url, key, type: pickedType });
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (idx) => {
    const removed = value[idx];
    onChange(value.filter((_, i) => i !== idx));
    if (removed?.key) deleteUpload(removed.key).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        {types && (
          <div className="sm:w-56">
            <label className="text-[13px] font-medium mb-1.5 block">Document type</label>
            <select
              className="flex h-10 w-full rounded-xl border border-inputBorderIdle bg-inputBg px-3.5 text-sm"
              value={pickedType}
              onChange={(e) => setPickedType(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <Button asChild type="button" variant="outline" disabled={busy}>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            {busy ? 'Uploading…' : 'Add document'}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={onSelect}
            />
          </label>
        </Button>
      </div>

      {value.length > 0 && (
        <ul className="divide-y divide-sectionBorder rounded-xl border border-sectionBorder bg-card">
          {value.map((doc, idx) => (
            <li key={doc.key || idx} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-medium uppercase">
                  {doc.url?.endsWith('.pdf') ? 'PDF' : 'IMG'}
                </div>
                <div className="min-w-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {(doc.key?.split('/').pop()) || 'document'}
                  </a>
                  <div className="text-xs text-muted-foreground">{doc.type}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
