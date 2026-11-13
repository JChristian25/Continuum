import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogContent = React.forwardRef(({ className, children, style, padded = true, showClose = true, overlayClassName, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop className={cn('library-dialog-overlay', overlayClassName)} />
    <DialogPrimitive.Popup ref={ref} className={cn('modal library-dialog-content', padded && 'library-dialog-padded', className)} style={style} {...props}>
      {children}
      {showClose && <DialogPrimitive.Close className="inspector__close library-dialog-close" aria-label="Close dialog"><X size={15} /></DialogPrimitive.Close>}
    </DialogPrimitive.Popup>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';
function DialogHeader({ className, ...props }) { return <div className={cn('library-dialog-header', className)} {...props} />; }
function DialogFooter({ className, ...props }) { return <div className={cn('library-dialog-footer', className)} {...props} />; }
export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
