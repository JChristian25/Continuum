import { CheckCircle2, RotateCcw, X, Info } from 'lucide-react';
import { Button } from './ui/index.js';

export default function Toast({ msg, hasUndo, onUndo, onDismiss }) {
  const isUndo = hasUndo;
  return (
    <div className="toast-container">
      <div className="toast" role="status" aria-live="polite">
        <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {isUndo ? <CheckCircle2 size={18} /> : <Info size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 500, lineHeight: 1.4 }}>
          {msg}
        </div>
        {hasUndo && (
          <Button
            variant="secondary"
            size="xs"
            onClick={onUndo}
            className="flex-shrink-0 gap-1 text-xs"
          >
            <RotateCcw size={12} />
            <span>Undo</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss toast"
          className="ml-1 text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
