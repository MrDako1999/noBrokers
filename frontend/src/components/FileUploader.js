import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FileText,
  ImageIcon,
  Check,
} from 'lucide-react';
import { uploadFile, deleteUpload } from '@/lib/uploads';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const TILE_MIME = 'application/x-fileuploader-tile';

// Single, reusable file uploader.
//
// Two visual variants share the same upload pipeline:
//   - "image-grid"   : aspect-square thumbnails with cover badge + drag reorder.
//                      Best for listing photos.
//   - "document-list": dropzone + vertical list with per-row type selector.
//                      Best for KYC / ownership verification.
//
// The dropzone is a <label> wrapping a hidden <input type="file"> directly,
// which is the most reliable way to open the OS file picker on every browser
// (no refs, no programmatic .click(), no nested-button pitfalls).
export default function FileUploader({
  value = [],
  onChange,
  kind,
  variant = 'image-grid',
  accept,
  multiple = true,
  maxFiles = 12,
  types,
  defaultType,
  helperText,
  emptyLabel,
  disabled = false,
}) {
  const isGrid = variant === 'image-grid';
  const resolvedAccept = accept || (isGrid ? 'image/*' : 'image/*,application/pdf');
  const fallbackEmpty = isGrid ? 'Add photos' : 'Add documents';
  const { toast } = useToast();

  const [pickedType, setPickedType] = useState(
    defaultType || types?.[0]?.value || 'other',
  );
  // clientId -> { name, progress } for currently-in-flight uploads
  const [pending, setPending] = useState({});
  const [isDragHover, setIsDragHover] = useState(false);

  // Drag-to-reorder state for image-grid
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dropTargetIdx, setDropTargetIdx] = useState(null);

  const remaining = Math.max(0, maxFiles - value.length);
  const atCap = remaining <= 0;

  // Mirror `value` into a ref so each parallel upload can append to the
  // *latest* committed array even when several finish in quick succession
  // (the prop snapshot in this render's closure would otherwise be stale).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // ---------- Upload pipeline ----------

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (files.length > remaining) {
      toast({
        variant: 'destructive',
        title: `Maximum ${maxFiles} ${isGrid ? 'images' : 'documents'}`,
        description: `You can upload ${remaining} more.`,
      });
      return;
    }

    const entries = files.map((file) => ({
      file,
      clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }));

    setPending((p) => {
      const next = { ...p };
      for (const e of entries) {
        next[e.clientId] = {
          name: e.file.name,
          progress: 0,
          done: false,
          previewUrl:
            typeof e.file.type === 'string' && e.file.type.startsWith('image/')
              ? URL.createObjectURL(e.file)
              : null,
        };
      }
      return next;
    });

    const removePending = (clientId, delay = 0) => {
      const drop = () =>
        setPending((p) => {
          if (!p[clientId]) return p;
          const { [clientId]: removed, ...rest } = p;
          if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
          return rest;
        });
      if (delay > 0) setTimeout(drop, delay);
      else drop();
    };

    // Run uploads in parallel and commit each file to the parent the moment
    // it finishes — no more "all bars stuck at 100% until the last one
    // finishes". Each tile flashes a checkmark for ~400ms before being
    // swapped for the real R2 thumbnail.
    await Promise.all(
      entries.map(async ({ file, clientId }) => {
        try {
          const result = await uploadFile(file, kind, (progress) => {
            setPending((p) =>
              p[clientId]
                ? { ...p, [clientId]: { ...p[clientId], progress } }
                : p,
            );
          });

          // Lock in the visual "done" state before the swap so the user
          // sees a clear "this one is finished" beat per file.
          setPending((p) =>
            p[clientId]
              ? { ...p, [clientId]: { ...p[clientId], progress: 1, done: true } }
              : p,
          );

          const newItem = {
            url: result.url,
            key: result.key,
            name: file.name,
            ...(types ? { type: pickedType } : {}),
          };
          const next = [...valueRef.current, newItem];
          valueRef.current = next;
          onChange(next);

          // Keep the green check on screen briefly, then drop the pending tile
          // so the new thumbnail (already in the grid) takes its visual slot.
          removePending(clientId, 450);
        } catch (e) {
          console.error('[FileUploader] upload error', file.name, e);
          toast({
            variant: 'destructive',
            title: `Upload failed: ${file.name}`,
            description: e.response?.data?.error || e.message,
          });
          removePending(clientId);
        }
      }),
    );
  };

  const onSelect = (e) => {
    const files = e.target.files;
    e.target.value = ''; // allow re-selecting the same file later
    handleFiles(files);
  };

  // ---------- Drag-and-drop file uploads ----------

  const isInternalTileDrag = (e) => {
    const dtTypes = Array.from(e.dataTransfer?.types || []);
    return dtTypes.includes(TILE_MIME);
  };

  const onZoneDragOver = (e) => {
    if (isInternalTileDrag(e)) return;
    e.preventDefault();
    if (!disabled && !atCap) setIsDragHover(true);
  };
  const onZoneDragLeave = () => setIsDragHover(false);
  const onZoneDrop = (e) => {
    setIsDragHover(false);
    if (disabled || atCap) return;
    if (isInternalTileDrag(e)) return;
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // ---------- Reorder ----------

  const onRemove = async (idx) => {
    const removed = value[idx];
    onChange(value.filter((_, i) => i !== idx));
    if (removed?.key) deleteUpload(removed.key).catch(() => {});
  };

  const onMove = (from, to) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onTileDragStart = (idx) => (e) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(TILE_MIME, String(idx));
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const onTileDragOver = (idx) => (e) => {
    if (draggingIdx == null && !isInternalTileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetIdx !== idx) setDropTargetIdx(idx);
  };
  const onTileDragLeave = (idx) => () => {
    if (dropTargetIdx === idx) setDropTargetIdx(null);
  };
  const onTileDrop = (idx) => (e) => {
    if (draggingIdx == null && !isInternalTileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const from = draggingIdx ?? Number(e.dataTransfer.getData(TILE_MIME));
    if (Number.isFinite(from)) onMove(from, idx);
    setDraggingIdx(null);
    setDropTargetIdx(null);
  };
  const onTileDragEnd = () => {
    setDraggingIdx(null);
    setDropTargetIdx(null);
  };

  const onChangeType = (idx, nextType) => {
    onChange(value.map((it, i) => (i === idx ? { ...it, type: nextType } : it)));
  };

  // The file input lives INSIDE each dropzone <label>, so clicking the label
  // opens the picker via the browser's native delegation. We hide it with
  // the standard "visually hidden" CSS pattern (clip-path + 1×1 px) rather
  // than `display: none`, because Chromium 147+ has a bug where `display:
  // none` file inputs activated by a label click open the picker but never
  // fire the `change` event. Inline styles (not Tailwind) so nothing can
  // override them.
  const visuallyHiddenInputStyle = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: 0,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
    opacity: 0,
  };
  const renderHiddenInput = () => (
    <input
      type="file"
      accept={resolvedAccept}
      multiple={multiple}
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      }}
      disabled={disabled || atCap}
      style={visuallyHiddenInputStyle}
    />
  );

  // ---------- Render ----------

  return (
    <div className="space-y-3">
      {/* Document-list: default-type picker for new uploads */}
      {!isGrid && types && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="sm:w-64">
            <label className="text-[13px] font-medium mb-1.5 block">
              Next document type
            </label>
            <select
              className="flex h-10 w-full rounded-xl border border-inputBorderIdle bg-inputBg px-3.5 text-sm"
              value={pickedType}
              onChange={(e) => setPickedType(e.target.value)}
              disabled={disabled}
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground sm:pb-2">
            New uploads use this type. You can change it per file after upload.
          </p>
        </div>
      )}

      {isGrid ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((img, idx) => (
            <div
              key={img.key || idx}
              draggable={!disabled}
              onDragStart={onTileDragStart(idx)}
              onDragOver={onTileDragOver(idx)}
              onDragEnter={onTileDragOver(idx)}
              onDragLeave={onTileDragLeave(idx)}
              onDrop={onTileDrop(idx)}
              onDragEnd={onTileDragEnd}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl border bg-muted transition-all cursor-grab active:cursor-grabbing',
                draggingIdx === idx
                  ? 'opacity-40 scale-[0.98] border-primary'
                  : 'border-sectionBorder',
                dropTargetIdx === idx && draggingIdx !== idx
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-card border-primary'
                  : '',
              )}
              title="Drag to reorder, or use arrows on hover"
            >
              <img
                src={img.url}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              />
              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-md text-white hover:bg-white/15 disabled:pointer-events-none disabled:opacity-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(idx, idx - 1);
                  }}
                  disabled={idx === 0}
                  aria-label="Move photo left — earlier position"
                  title="Earlier in grid"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-md text-white hover:bg-white/15 disabled:pointer-events-none disabled:opacity-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(idx, idx + 1);
                  }}
                  disabled={idx === value.length - 1}
                  aria-label="Move photo right — later position"
                  title="Later in grid"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {Object.entries(pending).map(([cid, p]) => (
            <PendingTile
              key={cid}
              progress={p.progress}
              name={p.name}
              previewUrl={p.previewUrl}
              done={p.done}
            />
          ))}

          {!atCap && (
            <label
              onDragOver={onZoneDragOver}
              onDragLeave={onZoneDragLeave}
              onDrop={onZoneDrop}
              className={cn(
                'group flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 transition-colors hover:border-primary hover:bg-muted',
                isDragHover ? 'border-primary bg-primary/5' : 'border-sectionBorder',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              {renderHiddenInput()}
              <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              <span className="text-xs text-muted-foreground">
                {emptyLabel || fallbackEmpty}
              </span>
            </label>
          )}
        </div>
      ) : (
        <>
          <label
            onDragOver={onZoneDragOver}
            onDragLeave={onZoneDragLeave}
            onDrop={onZoneDrop}
            className={cn(
              'group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary hover:bg-muted/40',
              isDragHover ? 'border-primary bg-primary/5' : 'border-sectionBorder',
              (disabled || atCap) && 'pointer-events-none opacity-60',
            )}
          >
            {renderHiddenInput()}
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">
              {emptyLabel || fallbackEmpty}
            </div>
            <div className="text-xs text-muted-foreground">
              Drop files here or click to browse · PDF, JPG, PNG up to 15MB
            </div>
            <span className="mt-1 inline-flex h-9 items-center rounded-lg border border-inputBorderIdle bg-transparent px-3 text-sm font-semibold text-foreground group-hover:bg-accent">
              <Plus className="h-4 w-4 mr-1.5" />
              Choose files
            </span>
          </label>

          {(value.length > 0 || Object.keys(pending).length > 0) && (
            <ul className="divide-y divide-sectionBorder rounded-xl border border-sectionBorder bg-card">
              {value.map((doc, idx) => (
                <li
                  key={doc.key || idx}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileTypeIcon url={doc.url} />
                    <div className="min-w-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {doc.name || doc.key?.split('/').pop() || 'document'}
                      </a>
                      {types ? (
                        <select
                          className="mt-1 max-w-full rounded-md border border-inputBorderIdle bg-inputBg px-2 py-1 text-xs"
                          value={doc.type || pickedType}
                          onChange={(e) => onChangeType(idx, e.target.value)}
                        >
                          {types.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {doc.type}
                        </div>
                      )}
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

              {Object.entries(pending).map(([cid, p]) => (
                <li
                  key={cid}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width] duration-150"
                        style={{ width: `${Math.round(p.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(p.progress * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

function PendingTile({ progress, name, previewUrl, done }) {
  const pct = Math.round(progress * 100);
  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-xl border bg-muted transition-colors',
        done ? 'border-success/60' : 'border-sectionBorder',
      )}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            done ? 'opacity-100' : 'opacity-90',
          )}
        />
      ) : null}
      {/* Subtle scrim so the spinner / check / progress text stay readable
          on top of the live preview. Lifts when the upload is done. */}
      <div
        className={cn(
          'absolute inset-0 transition-colors duration-200',
          done ? 'bg-black/10' : 'bg-black/35',
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {done ? (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-success text-white shadow-lg ring-4 ring-success/25">
            <Check className="h-5 w-5" />
          </span>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white drop-shadow" />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
        <div
          className="truncate text-[11px] font-medium text-white drop-shadow"
          title={name}
        >
          {name}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-150',
              done ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] font-medium tabular-nums text-white/90">
          {done ? 'Uploaded' : `${pct}% uploading`}
        </div>
      </div>
    </div>
  );
}

function FileTypeIcon({ url }) {
  const isPdf = url?.toLowerCase().endsWith('.pdf');
  const Icon = isPdf ? FileText : ImageIcon;
  return (
    <div
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-md',
        isPdf ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}
