import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Button as BaseButton } from '@base-ui/react/button';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'btn',
  {
    variants: {
      variant: {
        default: 'btn--accent',
        secondary: 'btn--secondary',
        outline: 'btn--secondary',
        subtle: 'btn--subtle',
        ghost: 'btn--ghost',
        destructive: 'btn--danger',
        accentSubtle: 'btn--accent'
      },
      size: {
        default: '',
        sm: 'btn--sm',
        xs: 'btn--xs',
        lg: 'btn--lg',
        icon: 'btn--icon',
        'icon-sm': 'btn--icon-sm',
        'icon-xs': 'btn--icon-xs'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : BaseButton;
  return (
    <Comp
      className={variant === 'unstyled' ? className : cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button };
