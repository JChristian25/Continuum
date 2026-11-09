import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileCode2,
  FileText,
  CheckSquare,
  ChevronRight,
  GitCompare,
  History,
  ShieldCheck,
  Split,
  Eye,
  Code2
} from 'lucide-react';
import { REVIEW_IDS } from '../data/workflow.js';
import { getStatusInfo, getWorkInfo } from '../data/helpers.js';
import CodeDiffShiki from './CodeDiffShiki.jsx';
import Tooltip from './Tooltip.jsx';
import { Button, Badge, Tabs, TabsList, TabsTrigger } from './ui/index.js';

function formatRationale(text) {
  if (!text) return null;
  const regex = /(`[^`]+`|\{[^}]+\}|[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\)|[a-zA-Z_0-9]+\["[^"]+"\]|"[^"]*"|§\d+\.\d+)/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={key++}>{text.substring(lastIdx, match.index)}</span>);
    }
    const val = match[0].replace(/^`|`$/g, '');
    parts.push(
      <code key={key++} className="table-code-inline">
        {val}
      </code>
    );
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.substring(lastIdx)}</span>);
  }
  return parts;
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'Code Elements':
      return { icon: FileCode2, wrapCls: 'icon-wrap--code', label: 'Code' };
    case 'Documentation':
      return { icon: FileText, wrapCls: 'icon-wrap--doc', label: 'Docs' };
    case 'Requirements':
      return { icon: CheckSquare, wrapCls: 'icon-wrap--req', label: 'Req' };
    case 'Decisions':
      return { icon: GitCompare, wrapCls: 'icon-wrap--dec', label: 'ADR' };
    default:
      return { icon: FileText, wrapCls: 'icon-wrap--doc', label: cat };
  }
}

export default function ChangesModule({ ctx }) {
  const { state, selectArtifact, toggleRevisionMode, openCodeExplorer } = ctx;
  const [showDiff, setShowDiff] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState('split'); // 'split' or 'unified'
  const [filter, setFilter] = useState('open');

  const neighbors = useMemo(() => {
    return REVIEW_IDS.map((id) => state.artifacts[id]).filter(Boolean);
  }, [state.artifacts]);

  const reviewedCount = state.revisionMode === 'R0'
    ? neighbors.filter(item => item.historyR0?.length).length
    : neighbors.filter((item) => item.r1Status === 'reviewed').length;

  const progressPct = neighbors.length ? Math.round((reviewedCount / neighbors.length) * 100) : 0;

  const visible = useMemo(() => {
    return neighbors.filter((item) => {
      if (state.revisionMode === 'R0') return true;
      if (filter === 'all') return true;
      if (filter === 'done') return item.r1Status === 'reviewed';
      return item.r1Status !== 'reviewed';
    });
  }, [neighbors, state.revisionMode, filter]);

  return (
    <div className="canvas-scroll review-workspace">
      {state.revisionMode === 'R0' && (
        <div className="historical-notice" role="alert">
          <History size={18} />
          <span>
            <strong>Historical Baseline View.</strong> Baseline confirms what was valid before the change; it does not close the review for the incoming change.
          </span>
          <Button variant="secondary" size="sm" onClick={toggleRevisionMode}>
            Switch to Incoming Change
          </Button>
        </div>
      )}

      {/* Header */}
      <header className="review-heading">
        <div>
          <h1>Review queue</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="neutral" className="font-mono text-[11px] gap-1.5">
              <GitCompare size={13} />
              <span>Baseline (a41c90e) → Incoming Change (8f3b21d)</span>
            </Badge>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Evaluate and record accountable human judgments for each connected artifact.
            </span>
          </div>
        </div>

        {/* Progress Card */}
        <Tooltip
          title="Review Cycle Progress"
          content={`${reviewedCount} of ${neighbors.length} artifacts evaluated for incoming change. ${neighbors.length - reviewedCount} decisions pending.`}
          side="bottom"
        >
          <div className="review-heading__progress" style={{ minWidth: 200, padding: '14px 18px', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cycle Progress
              </span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--ground-sunken)', overflow: 'hidden', marginBottom: 8 }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: progressPct === 100 ? 'var(--green)' : 'var(--accent)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span className={`status-dot ${reviewedCount === neighbors.length ? 'dot--green' : 'dot--amber'}`} />
              <strong style={{ color: 'var(--ink)' }}>{reviewedCount} / {neighbors.length} reviewed</strong>
            </div>
          </div>
        </Tooltip>
      </header>

      {state.revisionMode === 'R1' && <div className="review-loop-bar"><p><strong>{neighbors.length - reviewedCount} pending</strong> · Inspect the evidence, record your judgment, then continue to the next item.</p><div><button className="text-link" onClick={() => ctx.switchModule('summary')}>Review summary</button>{reviewedCount < neighbors.length && <button className="btn btn--accent" onClick={ctx.reviewNext}>Review next item <ChevronRight size={15} /></button>}</div></div>}

      {/* Changed Provider Seed Box */}
      <section className="change-focus" aria-label="Seed provider definition">
        <div className="change-focus__lead">
          <span className="change-focus__icon">
            <FileCode2 size={20} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>src/bbb.py · createRequest()</h2>
              <Tooltip title="Origin Seed Contract" content="Syntactic contract root extracted directly from Python AST via Tree-sitter" side="top">
                <Badge variant="accent" size="xs" className="font-mono cursor-help">Python AST Seed</Badge>
              </Tooltip>
            </div>
            <p style={{ marginTop: 4 }}>
              Return contract changed from scalar string <code style={{ color: 'var(--red)', fontWeight: 700 }}>str</code> to structured object dict <code style={{ color: 'var(--green)', fontWeight: 700 }}>{'{"id": str, "status": str}'}</code>.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {openCodeExplorer && (
            <Tooltip title="GitHub File & Symbols Viewer" content="Browse full source code with interactive right-docked AST symbols drawer" shortcut="R" side="top">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openCodeExplorer('src/bbb.py')}
                className="gap-1.5"
              >
                <Code2 size={13} />
                <span>GitHub Code &amp; Symbols Viewer</span>
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Semantic Shiki Diff" content="Toggle syntax-highlighted diff between baseline and incoming return contracts" side="top">
            <button
              type="button"
              className="text-link"
              onClick={() => setShowDiff((open) => !open)}
              aria-expanded={showDiff}
            >
              {showDiff ? 'Hide Diff' : 'View Code Diff'} {showDiff ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </Tooltip>
        </div>
      </section>

      {/* Rich Syntax-Highlighted Contract Diff */}
      {showDiff && (
        <section
          style={{
            marginBottom: 26,
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)',
            background: 'var(--ground-card)',
            overflow: 'hidden'
          }}
          aria-label="Code contract diff"
        >
          {/* Diff Controls Header */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--ground-sunken)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="font-mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                src/bbb.py
              </span>
              <Badge variant="neutral" size="xs" className="font-mono">
                Lines 14–22
              </Badge>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                variant={diffViewMode === 'split' ? 'default' : 'subtle'}
                size="xs"
                onClick={() => setDiffViewMode('split')}
                className="gap-1"
              >
                <Split size={12} />
                <span>Side-by-Side</span>
              </Button>
              <Button
                variant={diffViewMode === 'unified' ? 'default' : 'subtle'}
                size="xs"
                onClick={() => setDiffViewMode('unified')}
              >
                <span>Unified</span>
              </Button>
            </div>
          </div>

          {/* CodeDiffShiki TextMate Highlighting */}
          <CodeDiffShiki viewMode={diffViewMode} theme={ctx.theme} />

          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              background: 'var(--ground-sunken)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--ink-2)'
            }}
          >
            <CircleAlert size={15} color="var(--accent)" className="shrink-0" />
            <span>
              Tree-sitter detected signature modification. Review each downstream caller and documentation anchor below.
            </span>
          </div>
        </section>
      )}

      {/* Connected Artifacts Queue */}
      <section className="judgment-queue" aria-labelledby="judgment-queue-heading">
        <div className="section-heading">
          <div>
            <h2 id="judgment-queue-heading">Connected Artifacts for Accountable Judgment</h2>
            <p>Select an item to inspect its code context, test evidence, and record human judgment.</p>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList aria-label="Filter connected artifacts">
              <TabsTrigger value="open" className="gap-1.5">
                <span>Needs review</span>
                <span className="queue-pill-count">{neighbors.filter((n) => n.r1Status !== 'reviewed').length}</span>
              </TabsTrigger>
              <TabsTrigger value="done" className="gap-1.5">
                <span>Reviewed</span>
                <span className="queue-pill-count">{neighbors.filter((n) => n.r1Status === 'reviewed').length}</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                <span>All</span>
                <span className="queue-pill-count">{neighbors.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="judgment-queue-card">
          <div className="judgment-list">
            {visible.map((artifact) => {
              const status = getStatusInfo(artifact, state.revisionMode);
              const work = getWorkInfo(artifact, state.revisionMode);
              const selected = state.selectedArtifactId === artifact.id && state.inspectorOpen;
              const isReviewed = artifact.r1Status === 'reviewed';
              const catMeta = getCategoryIcon(artifact.category);
              const CatIcon = catMeta.icon;

              return (
                <div
                  key={artifact.id}
                  className={`judgment-row ${selected ? 'is-selected' : ''}`}
                  onClick={() => selectArtifact(artifact.id)}
                  role="button"
                  tabIndex="0"
                  aria-label={`Select ${artifact.shortName}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectArtifact(artifact.id);
                    }
                  }}
                >
                  <div className="judgment-row__lead">
                    <Tooltip title={artifact.category} content={`Artifact category in knowledge graph (${artifact.file || 'system'})`} side="top">
                      <div className={`judgment-row__icon-wrap ${catMeta.wrapCls}`} style={{ cursor: 'help' }}>
                        <CatIcon size={18} />
                        <span
                          className="judgment-row__status-dot"
                          style={{
                            background: isReviewed ? 'var(--green)' : 'var(--amber)'
                          }}
                        />
                      </div>
                    </Tooltip>
                    <div className="judgment-row__info">
                      <div className="judgment-row__title-row">
                        <span className="judgment-row__title">{artifact.shortName}</span>
                        <Badge variant="neutral" size="xs" className="font-mono">
                          {artifact.category}
                        </Badge>
                        {artifact.linkedIntentId && (
                          <Tooltip title="Linked Design Intent" content={artifact.linkedIntentTitle || 'Direct architectural intent link'} side="top">
                            <span className="table-intent-chip font-mono" style={{ cursor: 'help' }}>
                              {artifact.linkedIntentId}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                      <p className="judgment-row__reason">
                        {formatRationale(artifact.plainReason)}
                      </p>
                    </div>
                  </div>

                  <div className="judgment-row__tags">
                    <Tooltip title="Review Judgment" content={isReviewed ? `Signed off by ${artifact.r1Reviewer || 'reviewer'}` : 'Review decision pending for incoming change'} side="top">
                      <span className={`status-pill status-pill--sm ${status.cls}`} style={{ cursor: 'help' }}>
                        <span className={`status-dot ${status.dot}`} />
                        <span>{status.text}</span>
                      </span>
                    </Tooltip>

                    <Tooltip title="Follow-up Action" content={`Assigned disposition: ${work.text}`} side="top">
                      <span className={`status-pill status-pill--sm ${work.cls}`} style={{ cursor: 'help' }}>
                        <span className={`status-dot ${work.dot}`} />
                        <span>{work.text}</span>
                      </span>
                    </Tooltip>
                  </div>

                  <div className="judgment-row__actions">
                    <Tooltip title="Inspect Evidence" content="Open context drawer with code excerpts and signoff form" shortcut="↵" side="left">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectArtifact(artifact.id);
                        }}
                        className="gap-1.5"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                        <ChevronRight size={13} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}

            {!visible.length && (
              <div className="queue-empty">
                <CheckCircle2 size={28} color="var(--green)" />
                <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{filter === 'done' ? 'No judgments recorded yet' : 'Every queued item has a judgment'}</strong>
                <span style={{ fontSize: 12 }}>{filter === 'done' ? 'Recorded judgments will appear here.' : 'Review completion is separate from follow-up work and unknown coverage.'}</span>
                {filter !== 'done' && <button className="btn btn--accent" onClick={() => ctx.switchModule('summary')}>Continue to review summary <ChevronRight size={15} /></button>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Review Guidance Footer */}
      <aside className="review-guidance-card" aria-label="Review Guidance & Accountability">
        <div className="review-guidance-card__icon">
          <ShieldCheck size={18} />
        </div>
        <div className="review-guidance-card__content">
          <strong>Review Guidance &amp; Accountability</strong>
          <span>Confirm a valid relationship, keep it valid while assigning follow-up work, or reject a candidate. Your recorded rationale is saved locally in this demonstration workspace.</span>
        </div>
      </aside>
    </div>
  );
}
