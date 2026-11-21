import { useEffect, useRef, useState } from 'react';
import { Code2, FileText, Hash, Sparkles } from 'lucide-react';
import { Input, Disclosure } from './ui/index.js';

export default function SourceLinePicker({
  ctx,
  repositoryId,
  artifact,
  startLine,
  endLine,
  onChangeRange,
  disabled = false,
  defaultOpen = true,
}) {
  const versionId = artifact?.versionId || null;
  const preloaded = versionId ? ctx.detail?.sources?.find(s => s.id === versionId) : null;
  const [cache, setCache] = useState({});
  const [loadError, setLoadError] = useState(null);
  const bodyRef = useRef(null);

  const loaded = preloaded || (versionId ? cache[versionId] : null);
  const error = loadError?.versionId === versionId ? loadError.message : '';
  const loading = Boolean(repositoryId && versionId && !loaded && !error);

  useEffect(() => {
    if (!repositoryId || !versionId || preloaded || cache[versionId]) return;
    const abort = new AbortController();
    ctx.api.version(repositoryId, versionId, abort.signal)
      .then(data => {
        if (!abort.signal.aborted) {
          setCache(prev => ({ ...prev, [versionId]: data }));
          setLoadError(null);
        }
      })
      .catch(e => {
        if (!abort.signal.aborted && e.name !== 'AbortError') {
          setLoadError({ versionId, message: e.message || 'Source could not be loaded.' });
        }
      });
    return () => abort.abort();
  }, [repositoryId, versionId, preloaded, cache, ctx.api]);

  const lines = loaded?.content ? loaded.content.split('\n') : [];
  const totalLines = lines.length;
  const structureItems = loaded?.structure?.items || [];
  const parsedStart = Number(startLine);
  const parsedEnd = Number(endLine);
  const hasSelection = Number.isInteger(parsedStart) && parsedStart >= 1;
  const startNum = hasSelection ? parsedStart : 1;
  const endNum = hasSelection ? Math.max(startNum, Number.isInteger(parsedEnd) && parsedEnd >= startNum ? parsedEnd : startNum) : 1;

  const scrollToLine = targetLine => {
    const row = bodyRef.current?.querySelector(`[data-line="${targetLine}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  };

  const handleLineClick = (lineNo, event) => {
    if (disabled) return;
    if (hasSelection && event.shiftKey) {
      const lo = Math.min(startNum, lineNo);
      const hi = Math.max(startNum, lineNo);
      onChangeRange(lo, hi);
    } else {
      onChangeRange(lineNo, lineNo);
    }
  };

  const handleSetEnd = (lineNo, event) => {
    event.stopPropagation();
    if (disabled) return;
    if (!hasSelection) {
      onChangeRange(lineNo, lineNo);
      return;
    }
    const lo = Math.min(startNum, lineNo);
    const hi = Math.max(startNum, lineNo);
    onChangeRange(lo, hi);
  };

  if (!artifact) return null;

  return (
    <div className="service-picker">
      <div className="service-evidence-range">
        <label>
          Start line
          <Input
            type="number"
            min="1"
            max={totalLines || undefined}
            required
            disabled={disabled}
            placeholder="Pick line"
            value={startLine ?? ''}
            onChange={e => {
              const raw = e.target.value;
              if (!raw) {
                onChangeRange('', '');
                return;
              }
              const nextStart = Math.max(1, Number(raw) || 1);
              onChangeRange(nextStart, Math.max(nextStart, Number(endLine) || nextStart));
            }}
          />
        </label>
        <label>
          End line
          <Input
            type="number"
            min={hasSelection ? startNum : 1}
            max={totalLines || undefined}
            required
            disabled={disabled}
            placeholder="Pick line"
            value={endLine ?? ''}
            onChange={e => {
              const raw = e.target.value;
              if (!raw) {
                onChangeRange(hasSelection ? startNum : '', '');
                return;
              }
              const anchor = hasSelection ? startNum : Math.max(1, Number(raw) || 1);
              onChangeRange(anchor, Math.max(anchor, Number(raw) || anchor));
            }}
          />
        </label>
      </div>

      <Disclosure
        trigger={`Pick lines interactively in ${artifact.identity?.title || artifact.path}`}
        badge={hasSelection ? `Lines ${startNum}–${endNum}` : (totalLines ? `${totalLines} lines · unselected` : 'unselected')}
        defaultOpen={defaultOpen}
        variant="subtle"
        className="service-line-picker-box"
      >
        {loading && <p className="service-method" role="status">Loading captured version…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {loaded && (
          <>
            {structureItems.length > 0 && (
              <div className="service-structure-chips" aria-label="Jump to extracted symbol or section">
                <span className="service-structure-chips__label">
                  <Sparkles size={11} aria-hidden="true" />
                  {loaded.structure?.engine === 'tree-sitter-python' ? 'AST symbols' : 'Sections'}
                </span>
                {structureItems.slice(0, 18).map(item => {
                  const active = hasSelection && startNum === item.startLine && endNum === item.endLine;
                  const Icon = item.kind === 'section' ? Hash : Code2;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      className={`service-structure-chip ${active ? 'is-active' : ''}`}
                      title={`${item.signature} (lines ${item.startLine}–${item.endLine})`}
                      onClick={() => {
                        onChangeRange(item.startLine, item.endLine);
                        scrollToLine(item.startLine);
                      }}
                    >
                      <Icon size={10} aria-hidden="true" />
                      <span>{item.qualifiedName || item.name}</span>
                      <small>{item.startLine}–{item.endLine}</small>
                    </button>
                  );
                })}
              </div>
            )}
            <p className={`service-picker-hint ${hasSelection ? 'is-selected' : 'is-unselected'}`}>
              <FileText size={11} aria-hidden="true" />
              {hasSelection
                ? `Selected lines ${startNum}–${endNum} · Click a line to restart or Shift-click to extend`
                : 'No line range selected yet — click any line or symbol chip below'}
            </p>
            <div className="service-line-picker-body" ref={bodyRef}>
              {lines.map((lineText, idx) => {
                const lineNo = idx + 1;
                const inRange = hasSelection && lineNo >= startNum && lineNo <= endNum;
                return (
                  <div
                    key={lineNo}
                    data-line={lineNo}
                    className={`service-line-picker-row ${inRange ? 'is-in-range' : ''}`}
                    onClick={event => handleLineClick(lineNo, event)}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleLineClick(lineNo, event);
                      }
                    }}
                    aria-label={`Line ${lineNo}: ${lineText.slice(0, 80)}`}
                  >
                    <span className="service-line-picker-num">{lineNo}</span>
                    <code>{lineText || ' '}</code>
                    {!disabled && hasSelection && lineNo >= startNum && (
                      <button
                        type="button"
                        className="service-line-picker-end"
                        onClick={event => handleSetEnd(lineNo, event)}
                        title={`Set end line to ${lineNo}`}
                      >
                        End
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Disclosure>
    </div>
  );
}
