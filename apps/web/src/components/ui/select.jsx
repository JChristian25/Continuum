import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full" style={{ position: 'relative' }}>
      <select
        ref={ref}
        className={cn('select', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  );
});
Select.displayName = 'Select';

export { Select };
