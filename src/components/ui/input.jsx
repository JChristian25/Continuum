import * as React from 'react';
import { cn } from '../../lib/utils.js';

const Input = React.forwardRef(({ className, type, icon, ...props }, ref) => {
  if (icon) {
    return (
      <div className="input-wrap w-full" style={{ position: 'relative' }}>
        <span className="input-icon">
          {React.isValidElement(icon)
            ? icon
            : React.createElement(icon, { size: 14 })}
        </span>
        <input
          type={type}
          className={cn('input input--has-icon', className)}
          ref={ref}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      type={type}
      className={cn('input', className)}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
