import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Disclosure({
  trigger,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = '',
  triggerClassName = '',
  contentClassName = '',
  badge = null,
  variant = 'subtle',
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const toggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={cn('service-disclosure-root', `service-disclosure-root--${variant}`, isOpen && 'is-open', className)}>
      <button
        type="button"
        className={cn('service-disclosure-trigger', triggerClassName)}
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <span className="service-disclosure-label">{trigger}</span>
        {badge !== null && badge !== undefined && <span className="service-disclosure-badge">{badge}</span>}
        <ChevronDown size={15} className="service-disclosure-chevron" aria-hidden="true" />
      </button>
      {isOpen && <div className={cn('service-disclosure-content', contentClassName)}>{children}</div>}
    </div>
  );
}
