import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2, Plus, Tag, CalendarClock } from 'lucide-react';
import api from '@/lib/api';
import { uploadFile } from '@/lib/uploads';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPrice, formatRent } from '@/lib/format';
import SlotPicker from '@/components/SlotPicker';

// Composer renders the bottom row of ConversationView. It owns:
// - text input + Enter-to-send + Shift+Enter-newline
// - attachment upload (via uploadFile + 'chat-attachment' kind)
// - reply-preview pill above the input
// - "+" menu with inline action dialogs (offer / viewing) wired to
//   POST /chat/conversations/:id/messages with an `action` payload.

const TYPING_THROTTLE_MS = 3000;

export default function Composer({
  conversation,
  currentUser,
  presenceChannel,
  replyTo,
  onClearReply,
  onAfterSend,
  // Optimistic plumbing — owner (ConversationView) wires these into its
  // React Query cache so the bubble appears instantly and the network
  // round-trip just flips a tick.
  onOptimisticSend,
  onOptimisticAck,
  onOptimisticFail,
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState([]); // [{ id, file, progress, uploaded? }]
  const fileInputRef = useRef(null);
  const lastTypingAt = useRef(0);
  const taRef = useRef(null);

  // Focus on mount.
  useEffect(() => {
    taRef.current?.focus();
  }, [conversation?._id]);

  const myRole = conversation?.myRole;
  const listing = conversation?.listing;
  const linkedOffer = conversation?.linkedOfferId;
  const linkedViewing = conversation?.linkedViewingId;

  const handlePickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const items = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      progress: 0,
    }));
    setPending((prev) => [...prev, ...items]);
    items.forEach((it) => doUpload(it));
    e.target.value = '';
  };

  const doUpload = async (item) => {
    try {
      const result = await uploadFile(item.file, 'chat-attachment', (p) => {
        setPending((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, progress: p } : x)),
        );
      });
      setPending((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                progress: 1,
                uploaded: {
                  url: result.url,
                  key: result.key,
                  name: item.file.name,
                  size: item.file.size,
                  mimeType: item.file.type,
                },
              }
            : x,
        ),
      );
    } catch (err) {
      console.error('chat upload failed', err);
      setPending((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, error: err.message } : x)),
      );
    }
  };

  const removePending = (id) => {
    setPending((prev) => prev.filter((x) => x.id !== id));
  };

  const sendNow = async () => {
    const cleanText = text.trim();
    const ready = pending.filter((p) => p.uploaded);
    if (!cleanText && ready.length === 0) return;
    if (pending.length !== ready.length) return; // wait for uploads

    // Build the optimistic message *before* clearing inputs so we capture
    // the exact attachments + reply target the user pressed send on.
    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attachmentsPayload = ready.map((p) => p.uploaded);
    const optimistic = {
      _id: `optimistic-${clientId}`,
      _isOptimistic: true,
      clientId,
      status: 'sending',
      conversation: conversation._id,
      sender: currentUser
        ? { _id: currentUser._id, name: currentUser.name }
        : null,
      senderRole: conversation.myRole,
      type: attachmentsPayload.length ? 'attachment' : 'text',
      body: cleanText,
      attachments: attachmentsPayload,
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            body: replyTo.body,
            type: replyTo.type,
            attachments: replyTo.attachments,
            deletedAt: replyTo.deletedAt,
          }
        : null,
      readBy: [],
      createdAt: new Date().toISOString(),
    };

    // Snapshot reply for the API call, then clear UI immediately.
    const replyToId = replyTo?._id;
    setText('');
    setPending([]);
    onClearReply?.();
    onOptimisticSend?.(optimistic);
    onAfterSend?.();

    try {
      const { data } = await api.post(
        `/chat/conversations/${conversation._id}/messages`,
        {
          body: cleanText,
          attachments: attachmentsPayload,
          replyToId,
          clientId,
        },
      );
      onOptimisticAck?.(clientId, data.message);
    } catch (err) {
      console.error('send failed', err);
      onOptimisticFail?.(clientId, err);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendNow();
    }
  };

  const onTextChange = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTypingAt.current > TYPING_THROTTLE_MS) {
      lastTypingAt.current = now;
      try {
        presenceChannel?.trigger?.('client-typing', { at: now });
      } catch {
        // ignore — happens when channel isn't subscribed yet
      }
    }
  };

  // ---- Inline-action dialogs ---------------------------------------------
  const [offerOpen, setOfferOpen] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);

  return (
    <div className="border-t border-sectionBorder bg-card px-2 py-2">
      {replyTo && (
        <div className="mb-1.5 flex items-start gap-2 rounded-lg bg-secondary/60 px-2 py-1.5 text-[11px]">
          <div className="flex-1 truncate">
            <span className="font-semibold">Replying:</span>{' '}
            <span className="opacity-80">
              {replyTo.deletedAt
                ? 'Deleted message'
                : replyTo.body || (replyTo.attachments?.length ? '📎 Attachment' : 'Message')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="grid h-5 w-5 place-items-center rounded hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-1.5 grid grid-cols-3 gap-1.5">
          {pending.map((p) => (
            <PendingPill key={p.id} item={p} onRemove={() => removePending(p.id)} />
          ))}
        </div>
      )}

      <div className="flex items-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Quick actions"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-[180px]">
            {myRole === 'buyer' && (
              <>
                <DropdownMenuItem onSelect={() => setOfferOpen(true)}>
                  <Tag className="h-3.5 w-3.5" /> Make an offer
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setViewingOpen(true)}>
                  <CalendarClock className="h-3.5 w-3.5" /> Request viewing
                </DropdownMenuItem>
              </>
            )}
            {myRole === 'owner' && linkedOffer && linkedOffer.status !== 'accepted' && (
              <>
                <DropdownMenuItem onSelect={() => setOfferOpen(true)}>
                  <Tag className="h-3.5 w-3.5" /> Counter offer
                </DropdownMenuItem>
              </>
            )}
            {!myRole || (myRole === 'owner' && !linkedOffer) ? (
              <DropdownMenuItem disabled>No quick actions</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          aria-label="Attach"
          onClick={() => fileInputRef.current?.click()}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handlePickFiles}
        />

        <textarea
          ref={taRef}
          value={text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="min-h-[40px] max-h-[140px] flex-1 resize-none rounded-2xl border border-inputBorderIdle bg-inputBg px-3 py-2 text-sm leading-tight outline-none focus:border-inputBorderFocus"
        />

        <button
          type="button"
          aria-label="Send"
          onClick={sendNow}
          disabled={
            (!text.trim() && pending.filter((p) => p.uploaded).length === 0) ||
            pending.some((p) => !p.uploaded && !p.error)
          }
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {offerOpen && (
        <OfferActionDialog
          open={offerOpen}
          onOpenChange={setOfferOpen}
          conversation={conversation}
          mode={myRole === 'owner' && linkedOffer ? 'counter' : 'create'}
          onSent={onAfterSend}
        />
      )}
      {viewingOpen && (
        <ViewingActionDialog
          open={viewingOpen}
          onOpenChange={setViewingOpen}
          listingId={listing?._id}
          conversationId={conversation._id}
          onSent={onAfterSend}
        />
      )}
    </div>
  );
}

function PendingPill({ item, onRemove }) {
  const isImage = item.file?.type?.startsWith('image/');
  const objectUrl = isImage ? URL.createObjectURL(item.file) : null;
  return (
    <div className="relative h-16 overflow-hidden rounded-lg border border-sectionBorder bg-background">
      {isImage ? (
        <img src={objectUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center px-1 text-[10px] text-muted-foreground">
          📎 <span className="line-clamp-2">{item.file.name}</span>
        </div>
      )}
      {item.progress < 1 && !item.error && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white text-[10px]">
          {Math.round((item.progress || 0) * 100)}%
        </div>
      )}
      {item.error && (
        <div className="absolute inset-0 grid place-items-center bg-destructive/80 text-white text-[10px]">
          Failed
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

function OfferActionDialog({ open, onOpenChange, conversation, mode, onSent }) {
  const listing = conversation?.listing;
  const isSale = listing?.listingType === 'sale';
  const asking = isSale ? listing?.price : listing?.monthlyRent;
  const linkedOffer = conversation?.linkedOfferId;
  const [amount, setAmount] = useState(asking || linkedOffer?.currentAmount || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      const action =
        mode === 'create'
          ? { kind: 'offer.create', amount: Number(amount), message }
          : {
              kind: 'offer.respond',
              offerId: String(linkedOffer._id),
              decision: 'counter',
              amount: Number(amount),
              message,
            };
      await api.post(`/chat/conversations/${conversation._id}/messages`, { action });
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      console.error('offer action failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Make an offer' : 'Counter offer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="offer-amount">
              Amount {isSale ? '(RM)' : '(RM/month)'}
            </Label>
            <Input
              id="offer-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {asking && (
              <div className="text-[11px] text-muted-foreground">
                Asking: {isSale ? formatPrice(asking) : formatRent(asking)}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-message">Note (optional)</Label>
            <Textarea
              id="offer-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !amount}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewingActionDialog({ open, onOpenChange, listingId, conversationId, onSent }) {
  const [slot, setSlot] = useState(null);
  const [mode, setMode] = useState('in_person');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!slot) return;
    setSubmitting(true);
    try {
      await api.post(`/chat/conversations/${conversationId}/messages`, {
        action: {
          kind: 'viewing.create',
          startAt: slot.startAt,
          endAt: slot.endAt,
          mode,
          notes,
        },
      });
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      console.error('viewing action failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request a viewing</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SlotPicker listingId={listingId} selected={slot} onSelect={setSlot} />
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="vw-mode">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id="vw-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In person</SelectItem>
                  <SelectItem value="virtual">Virtual tour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vw-notes">Note to owner (optional)</Label>
              <Input
                id="vw-notes"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !slot}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
