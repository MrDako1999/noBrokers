import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, ChevronLeft } from 'lucide-react';
import useAuthStore from '@/stores/authStore';
import useChatStore from '@/stores/chatStore';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ConversationList from './ConversationList';
import ConversationView from './ConversationView';

// Heartbeat cadence — bumps `User.lastSeenAt` so the counterpart can
// render "last seen 2m ago" when offline. Cheap write; only runs when
// the widget is open and the user is logged in.
const HEARTBEAT_MS = 60 * 1000;

export default function ChatWidget() {
  const { user, isLoading } = useAuthStore();
  const { isOpen, toggle, close, activeConversationId, setActive, totalUnread, loadInbox } =
    useChatStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on the auth pages — they have their own minimal chrome
  // and the widget would steal focus from the login form. Also hide on
  // the dedicated /dashboard/messages page where the inbox is the
  // primary surface.
  const onAuthPage =
    location.pathname.startsWith('/login') || location.pathname.startsWith('/register');
  const onMessagesPage = location.pathname.startsWith('/dashboard/messages');

  // Refresh the inbox whenever the user changes (login/logout) or the
  // widget is opened from a cold state. While the widget is open, poll
  // every 30s so newly-opened conversations from counterparts (owner
  // can't be Pusher-subscribed to them yet) appear without a refresh.
  useEffect(() => {
    if (!user) return undefined;
    loadInbox();
    if (!isOpen) return undefined;
    const id = setInterval(loadInbox, 30 * 1000);
    return () => clearInterval(id);
  }, [user, loadInbox, isOpen]);

  // Heartbeat loop while open + signed in.
  useEffect(() => {
    if (!user || !isOpen) return undefined;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      api.post('/auth/heartbeat').catch(() => {
        /* ignore — best effort */
      });
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, isOpen]);

  if (isLoading || onAuthPage || onMessagesPage) return null;

  // ---- Logged-out: show a hint popover -----------------------------------
  if (!user) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg"
              aria-label="Chat"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            sideOffset={12}
            className="w-72"
          >
            <div className="space-y-2">
              <div className="font-heading font-semibold">Sign in to chat</div>
              <p className="text-sm text-muted-foreground">
                Talk to property owners, send offers, and request viewings — all in one place.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  const next = encodeURIComponent(location.pathname + location.search);
                  navigate(`/login?next=${next}`);
                }}
              >
                Sign in
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // ---- Logged-in: bubble + (when open) panel -----------------------------
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div
          className="
            mb-3 flex flex-col overflow-hidden rounded-2xl border border-sectionBorder bg-card shadow-2xl
            w-[min(92vw,380px)] h-[min(85vh,640px)]
            sm:w-[380px] sm:h-[640px]
          "
        >
          <div className="flex items-center gap-2 border-b border-sectionBorder px-3 py-2.5">
            {activeConversationId && (
              <button
                type="button"
                aria-label="Back to inbox"
                onClick={() => setActive(null)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="font-heading font-semibold flex-1 truncate">
              {activeConversationId ? 'Chat' : 'Messages'}
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={close}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            {activeConversationId ? (
              <ConversationView conversationId={activeConversationId} />
            ) : (
              <ConversationList />
            )}
          </div>
        </div>
      )}

      <Button
        size="icon"
        className="relative h-12 w-12 rounded-full shadow-lg"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        onClick={toggle}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-[20px] h-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </Button>
    </div>
  );
}
