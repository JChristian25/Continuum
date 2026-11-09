import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const DialogContext = React.createContext({
  open: false,
  onOpenChange: () => {}
});

function Dialog({ open, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;
  const handleOpenChange = React.useCallback(
    (next) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open: currentOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ asChild, children, ...props }) {
  const { onOpenChange } = React.useContext(DialogContext);
  const handleClick = (e) => {
    props.onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      'aria-haspopup': 'dialog'
    });
  }

  return (
    <button type="button" onClick={handleClick} aria-haspopup="dialog" {...props}>
      {children}
    </button>
  );
}

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(DialogContext);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 1000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className={cn('modal', className)}
        style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
        {...props}
      >
        <div style={{ padding: 24 }}>
          {children}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="inspector__close"
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            zIndex: 10
          }}
          aria-label="Close dialog"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
});
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, style, ...props }) {
  return (
    <div
      className={className}
      style={{ marginBottom: 16, textAlign: 'left', ...style }}
      {...props}
    />
  );
}

function DialogFooter({ className, style, ...props }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', ...style }}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef(({ className, style, ...props }, ref) => (
  <h2
    ref={ref}
    className={className}
    style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', ...style }}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={className}
    style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4, marginBottom: 0, lineHeight: 1.5, ...style }}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

function DialogClose({ asChild, children, ...props }) {
  const { onOpenChange } = React.useContext(DialogContext);
  const handleClick = (e) => {
    props.onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: handleClick });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
};
