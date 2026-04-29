import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-sectionBorder text-foreground',
        success: 'bg-success-bg text-success border border-success/20',
        warning: 'bg-warning-bg text-warning border border-warning/20',
        info: 'bg-info-bg text-info border border-info/20',
        destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
