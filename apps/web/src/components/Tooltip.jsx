import { isValidElement } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
export default function Tooltip({ content, title, shortcut, side = 'top', delay = 40, disabled = false, maxWidth = 280, children }) {
  if (!isValidElement(children) || !(content || title)) return children;
  return <TooltipPrimitive.Provider delayDuration={delay}>
    <TooltipPrimitive.Root open={disabled ? false : undefined}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={7} collisionPadding={12} className="continuum-tooltip library-tooltip" style={{ maxWidth }}>
          <div className="continuum-tooltip__inner"><div className="continuum-tooltip__text-wrap">
            {title && <strong className="continuum-tooltip__title">{title}</strong>}
            {content && <span className="continuum-tooltip__content">{content}</span>}
          </div>{shortcut && <kbd className="continuum-tooltip__kbd">{shortcut}</kbd>}</div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>;
}
