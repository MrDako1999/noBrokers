import { Link } from 'react-router-dom';
import {
  Tag,
  CalendarClock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  CalendarCheck,
  CalendarX,
  CalendarDays,
  CircleSlash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice, formatRent, formatInZone } from '@/lib/format';
import api from '@/lib/api';

// Renders a centered system pill describing an offer/viewing event, with
// optional inline action buttons for the recipient.
//
// `myRole` is the current user's role on the conversation ('buyer' | 'owner').
// `conversationId` is needed to dispatch action POSTs to the chat API.

export default function SystemMessage({ message, myRole, conversationId, onActioned }) {
  const evt = message.systemEvent;
  if (!evt) return null;

  const meta = describe(evt, myRole);
  const actions = actionsFor(evt, myRole);

  const onAction = async (action) => {
    try {
      await api.post(`/chat/conversations/${conversationId}/messages`, { action });
      onActioned?.();
    } catch (err) {
      console.error('inline action failed', err);
    }
  };

  return (
    <div className="my-2 flex justify-center px-2">
      <div className="max-w-[92%] rounded-2xl border border-sectionBorder bg-secondary/40 px-3 py-2 text-center text-xs">
        <div className="inline-flex items-center gap-1.5 text-foreground">
          <meta.Icon className="h-3.5 w-3.5" />
          <span className="font-medium">{meta.title}</span>
        </div>
        {meta.subtitle && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{meta.subtitle}</div>
        )}

        {meta.deepLink && (
          <div className="mt-1.5">
            <Link
              to={meta.deepLink}
              className="text-[11px] text-accentStrong underline-offset-2 hover:underline"
            >
              View {meta.deepLinkLabel}
            </Link>
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {actions.map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant={a.variant || 'outline'}
                className="h-7 px-2 text-[11px]"
                onClick={() => onAction(a.action)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function priceFor(evt) {
  const isRent = evt.payload?.type === 'rent';
  const amount = evt.payload?.amount;
  if (amount == null) return null;
  return isRent ? formatRent(amount) : formatPrice(amount);
}

function describe(evt, myRole) {
  const actor = evt.payload?.actorRole;
  const actorLabel = actor === myRole ? 'You' : actor === 'buyer' ? 'Buyer' : 'Owner';
  const offerDeep = `/dashboard/offers/${evt.refId}`;
  const viewingDeep = `/dashboard/viewings/${evt.refId}`;

  switch (evt.kind) {
    case 'offer_made': {
      const price = priceFor(evt);
      return {
        Icon: Tag,
        title: `${actorLabel} sent an offer${price ? ` of ${price}` : ''}`,
        subtitle: evt.payload?.message || null,
        deepLink: offerDeep,
        deepLinkLabel: 'offer',
      };
    }
    case 'offer_countered': {
      const price = priceFor(evt);
      return {
        Icon: RotateCcw,
        title: `${actorLabel} countered${price ? ` at ${price}` : ''}`,
        subtitle: evt.payload?.message || null,
        deepLink: offerDeep,
        deepLinkLabel: 'offer',
      };
    }
    case 'offer_accepted':
      return {
        Icon: CheckCircle2,
        title: `${actorLabel} accepted the offer`,
        subtitle: priceFor(evt),
        deepLink: offerDeep,
        deepLinkLabel: 'offer',
      };
    case 'offer_rejected':
      return {
        Icon: XCircle,
        title: `${actorLabel} rejected the offer`,
        subtitle: evt.payload?.message || null,
        deepLink: offerDeep,
        deepLinkLabel: 'offer',
      };
    case 'offer_withdrawn':
      return {
        Icon: CircleSlash,
        title: `${actorLabel} withdrew the offer`,
        deepLink: offerDeep,
        deepLinkLabel: 'offer',
      };
    case 'viewing_requested':
      return {
        Icon: CalendarClock,
        title: `${actorLabel} requested a viewing`,
        subtitle: formatRange(evt),
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_accepted':
      return {
        Icon: CalendarCheck,
        title: `${actorLabel} accepted the viewing`,
        subtitle: formatRange(evt),
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_declined':
      return {
        Icon: CalendarX,
        title: `${actorLabel} declined the viewing`,
        subtitle: evt.payload?.reason || null,
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_cancelled':
      return {
        Icon: CalendarX,
        title: `${actorLabel} cancelled the viewing`,
        subtitle: evt.payload?.reason || null,
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_proposed':
      return {
        Icon: CalendarDays,
        title: `${actorLabel} proposed a new time`,
        subtitle: formatRange(evt, 'proposedStartAt', 'proposedEndAt'),
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_completed':
      return {
        Icon: CheckCircle2,
        title: `Viewing marked as completed`,
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    case 'viewing_no_show':
      return {
        Icon: CircleSlash,
        title: `Viewing marked as no-show`,
        deepLink: viewingDeep,
        deepLinkLabel: 'viewing',
      };
    default:
      return { Icon: Tag, title: 'Update' };
  }
}

function formatRange(evt, startKey = 'startAt', endKey = 'endAt') {
  const s = evt.payload?.[startKey];
  if (!s) return null;
  return formatInZone(s, 'Asia/Kuala_Lumpur');
}

function actionsFor(evt, myRole) {
  // Only the *recipient* sees actionable buttons. Outer guards mean the
  // payload `actorRole` is always set.
  const isRecipient = evt.payload?.actorRole && evt.payload.actorRole !== myRole;
  if (!isRecipient) return [];

  switch (evt.kind) {
    case 'offer_made':
    case 'offer_countered':
      return [
        {
          label: 'Accept',
          variant: 'default',
          action: { kind: 'offer.respond', offerId: String(evt.refId), decision: 'accept' },
        },
        {
          label: 'Reject',
          variant: 'outline',
          action: { kind: 'offer.respond', offerId: String(evt.refId), decision: 'reject' },
        },
      ];
    case 'viewing_requested':
      return [
        {
          label: 'Accept',
          variant: 'default',
          action: { kind: 'viewing.respond', viewingId: String(evt.refId), decision: 'accept' },
        },
        {
          label: 'Decline',
          variant: 'outline',
          action: { kind: 'viewing.respond', viewingId: String(evt.refId), decision: 'decline' },
        },
      ];
    case 'viewing_proposed':
      return [
        {
          label: 'Accept time',
          variant: 'default',
          action: {
            kind: 'viewing.respond',
            viewingId: String(evt.refId),
            decision: 'accept',
          },
        },
      ];
    default:
      return [];
  }
}
