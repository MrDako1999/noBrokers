import { cn } from '@/lib/utils';

// Inline SVG so the logo gets the brand colour from CSS (currentColor).
// Drop a real logo at /public/brand/logo.svg later and swap this file
// for an <img> if the brand wordmark needs to be raster.
export default function BrandLogo({ className, withText = true }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12 L12 4 L21 12" />
          <path d="M5.5 11 V20 H18.5 V11" />
          <line x1="3" y1="20" x2="21" y2="4" />
        </svg>
      </span>
      {withText && (
        <span className="font-heading font-bold text-lg tracking-tight">
          no<span className="text-primary">Brokers</span>
          <span className="text-muted-foreground">.my</span>
        </span>
      )}
    </div>
  );
}
