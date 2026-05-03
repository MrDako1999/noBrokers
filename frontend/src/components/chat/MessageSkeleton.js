// Shimmer placeholder rendered while the messages query is loading and
// no cached pages exist yet. The widths are deliberately mismatched so it
// looks like real chatter, alternating left/right to mirror the bubble
// layout.

const ROWS = [
  { mine: false, w: 'w-40' },
  { mine: false, w: 'w-56' },
  { mine: true, w: 'w-32' },
  { mine: false, w: 'w-48' },
  { mine: true, w: 'w-44' },
  { mine: true, w: 'w-28' },
];

export default function MessageSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2" aria-hidden="true">
      {ROWS.map((r, i) => (
        <div key={i} className={`flex ${r.mine ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`h-8 ${r.w} max-w-[78%] animate-pulse rounded-2xl ${
              r.mine
                ? 'rounded-br-md bg-primary/20'
                : 'rounded-bl-md bg-secondary'
            }`}
          />
        </div>
      ))}
    </div>
  );
}
