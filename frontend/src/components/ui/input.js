import * as React from 'react';
import { cn } from '@/lib/utils';

// Soft-fill input. Optional `icon` prop renders a lucide icon in the
// leading slot — pass it as the component, not an instance:
//   <Input icon={Search} placeholder="..." />
const Input = React.forwardRef(({ className, type, icon: Icon, ...props }, ref) => {
  const inputElement = (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-inputBorderIdle bg-inputBg px-3.5 text-sm text-foreground transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:border-inputBorderFocus',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        Icon && 'pl-10',
        className,
      )}
      {...props}
    />
  );

  if (!Icon) return inputElement;

  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
        aria-hidden="true"
      />
      {inputElement}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
