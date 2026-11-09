import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'badge',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        neutral: 'badge--neutral',
        accent: 'badge--accent',
        success: 'badge--green',
        warning: 'badge--amber',
        destructive: 'badge--red',
        outline: 'badge--neutral'
      },
      size: {
        default: '',
        sm: 'badge--sm',
        xs: 'badge--xs'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Badge({ className, variant, size, children, dot, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full shrink-0',
            dot === 'green' && 'bg-[var(--green)]',
            dot === 'amber' && 'bg-[var(--amber)]',
            dot === 'red' && 'bg-[var(--red)]',
            dot === 'accent' && 'bg-[var(--accent)]',
            dot === 'neutral' && 'bg-[var(--ink-3)]'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge };
