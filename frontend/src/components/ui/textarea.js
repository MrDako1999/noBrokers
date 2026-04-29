import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[100px] w-full rounded-xl border border-inputBorderIdle bg-inputBg px-3.5 py-2.5 text-sm text-foreground transition-colors',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:border-inputBorderFocus',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
