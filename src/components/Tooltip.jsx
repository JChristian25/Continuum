import { useState, useRef, useEffect, useId, isValidElement } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible, lightweight Tooltip component.
 * Uses display: contents wrapper to preserve flex and grid layouts without layout disruption.
 * Uses createPortal to document.body to prevent any container overflow clipping.
 */
export default function Tooltip({
  content,
  title,
  shortcut,
  side = 'top',
  delay = 40,
  disabled = false,
  maxWidth = 280,
  children
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, actualSide: side });
  const timerRef = useRef(null);
  const targetElRef = useRef(null);
  const tooltipId = useId();

  const showTooltip = isVisible && !disabled && Boolean(content || title);

  const updatePosition = (target) => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const gap = 7;
    let actualSide = side;

    const vWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Viewport collision bounds detection
    if (side === 'top' && rect.top - gap < 36) {
      actualSide = 'bottom';
    } else if (side === 'bottom' && rect.bottom + gap > vHeight - 36) {
      actualSide = 'top';
    } else if (side === 'left' && rect.left - gap < 40) {
      actualSide = 'right';
    } else if (side === 'right' && rect.right + gap > vWidth - 40) {
      actualSide = 'left';
    }

    let top = 0;
    let left = 0;

    if (actualSide === 'top') {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    } else if (actualSide === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    } else if (actualSide === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else if (actualSide === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    }

    setCoords({ top, left, actualSide });
  };

  const handleMouseEnter = (e) => {
    if (disabled || (!content && !title)) return;
    const el = e.currentTarget;
    targetElRef.current = el;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updatePosition(el);
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const handleFocus = (e) => {
    if (disabled || (!content && !title)) return;
    const el = e.currentTarget;
    targetElRef.current = el;
    updatePosition(el);
    setIsVisible(true);
  };

  const handleBlur = () => {
    clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (!showTooltip) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsVisible(false);
    };
    const onScroll = () => {
      setIsVisible(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showTooltip]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!isValidElement(children)) {
    return children;
  }

  return (
    <>
      <span
        className="tooltip-trigger-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={showTooltip ? tooltipId : undefined}
      >
        {children}
      </span>
      {showTooltip && typeof document !== 'undefined' && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className={`continuum-tooltip continuum-tooltip--${coords.actualSide}`}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth
          }}
        >
          <div className="continuum-tooltip__inner">
            <div className="continuum-tooltip__text-wrap">
              {title && <strong className="continuum-tooltip__title">{title}</strong>}
              {content && <span className="continuum-tooltip__content">{content}</span>}
            </div>
            {shortcut && <kbd className="continuum-tooltip__kbd">{shortcut}</kbd>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
