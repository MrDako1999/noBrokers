import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Trash2, Reply, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import api from '@/lib/api';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export default function MessageBubble({
  message,
  isMine,
  counterpartId,
  onReply,
  onLocalEdit,
  onLocalDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body || '');
  const [busy, setBusy] = useState(false);
  const draftRef = useRef(null);

  useEffect(() => {
    if (editing) draftRef.current?.focus();
  }, [editing]);

  const isDeleted = !!message.deletedAt;
  const editable =
    isMine &&
    !isDeleted &&
    message.type === 'text' &&
    Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;

  // Read receipts: count entries in readBy from the counterpart.
  const seenByCounterpart = !!message.readBy?.find(
    (r) => String(r.user?._id || r.user) === String(counterpartId),
  );

  const handleEditSubmit = async (e) => {
    e?.preventDefault();
    if (!draft.trim() || draft.trim() === message.body) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.patch(`/chat/messages/${message._id}`, { body: draft.trim() });
      onLocalEdit?.(data.message);
      setEditing(false);
    } catch (err) {
      console.error('edit failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this message for everyone?')) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/chat/messages/${message._id}`);
      onLocalDelete?.(data.message);
    } catch (err) {
      console.error('delete failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex w-full items-end gap-1.5 px-3',
        isMine ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isMine
            ? 'rounded-br-md bg-primary text-white'
            : 'rounded-bl-md bg-secondary text-secondary-foreground',
        )}
      >
        {message.replyTo && !isDeleted && <ReplyPreview parent={message.replyTo} mineBubble={isMine} />}

        {isDeleted ? (
          <div className={cn('italic opacity-80', isMine ? 'text-white/90' : 'text-muted-foreground')}>
            This message was deleted
          </div>
        ) : editing ? (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-1.5">
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="min-w-[180px] resize-none rounded-md bg-white/10 px-2 py-1 text-sm outline-none ring-1 ring-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) handleEditSubmit(e);
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="flex justify-end gap-1.5 text-[11px]">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className="rounded px-2 py-0.5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-white/20 px-2 py-0.5 font-semibold hover:bg-white/30"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            {message.body && (
              <div className="whitespace-pre-wrap break-words">{message.body}</div>
            )}
            {message.attachments?.length > 0 && (
              <div className={cn('flex flex-col gap-1.5', message.body && 'mt-1.5')}>
                {message.attachments.map((att) => (
                  <Attachment key={att.key} att={att} mineBubble={isMine} />
                ))}
              </div>
            )}
          </>
        )}

        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px] opacity-80',
            isMine ? 'justify-end text-white/85' : 'justify-end text-muted-foreground',
          )}
        >
          {message.editedAt && !isDeleted && <span>edited</span>}
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
          {isMine && !isDeleted && (
            <span aria-label={seenByCounterpart ? 'Seen' : 'Sent'}>
              {seenByCounterpart ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      </div>

      {!isDeleted && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Message actions"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-accent"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isMine ? 'end' : 'start'} className="min-w-[140px]">
            <DropdownMenuItem onSelect={() => onReply?.(message)}>
              <Reply className="h-3.5 w-3.5" /> Reply
            </DropdownMenuItem>
            {editable && (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
            )}
            {isMine && (
              <DropdownMenuItem onSelect={handleDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function ReplyPreview({ parent, mineBubble }) {
  if (!parent) return null;
  return (
    <div
      className={cn(
        'mb-1 rounded-md border-l-2 px-2 py-1 text-[11px]',
        mineBubble ? 'border-white/60 bg-white/10' : 'border-primary/40 bg-background/50',
      )}
    >
      <div className={cn('line-clamp-2 opacity-90')}>
        {parent.deletedAt
          ? 'Deleted message'
          : parent.body || (parent.attachments?.length ? '📎 Attachment' : 'Message')}
      </div>
    </div>
  );
}

function Attachment({ att, mineBubble }) {
  const isImage = att.mimeType?.startsWith('image/');
  const isVideo = att.mimeType?.startsWith('video/');
  const isAudio = att.mimeType?.startsWith('audio/');

  if (isImage) {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={att.url}
          alt={att.name || 'attachment'}
          className="max-h-64 rounded-lg object-cover"
        />
      </a>
    );
  }
  if (isVideo) {
    return <video src={att.url} controls className="max-h-64 w-full rounded-lg" />;
  }
  if (isAudio) {
    return <audio src={att.url} controls className="w-full" />;
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] underline-offset-2 hover:underline',
        mineBubble ? 'bg-white/15 text-white' : 'bg-background/60 text-foreground',
      )}
    >
      📎 <span className="truncate">{att.name || 'Attachment'}</span>
    </a>
  );
}
