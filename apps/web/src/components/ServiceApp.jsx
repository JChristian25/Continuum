import { Button, Checkbox, Input, Select, Textarea, Dialog, DialogContent, DialogTitle, DialogDescription, Tabs, TabsList, TabsTrigger, TabsContent, Disclosure } from './ui/index.js';
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  Infinity as InfinityIcon, ArrowRight, X, RefreshCw, Search, FileText, FileCode2,
  ChevronRight, ChevronDown, GitBranch, ShieldCheck, Eye, EyeOff, CheckCircle2, Copy, Check,
  GitCompare, ListChecks, LogOut, FolderGit2, Clock, Sun, Moon,
  AlertTriangle, Network, Layers, List, Link2, Sparkles, Cpu, Info, Archive, GitCommit,
  Code2, Hash, FolderPlus
} from 'lucide-react';
import Shell from './Shell.jsx';
import Tooltip from './Tooltip.jsx';
import SourceLinePicker from './SourceLinePicker.jsx';
import CustomWorkspaceModal from './CustomWorkspaceModal.jsx';
import { useContinuum } from '../context/ContinuumBase.js';
import { allSelections, buildCompareOptions, contextEnvelope, permittedDecisions, permittedTriageDispositions, optionalReason, reasonLabel, REASON_PRESETS } from '../data/serviceModel.js';
import { computeLineDiff } from '../data/diff.js';
import { analyzeRelationshipMeaning, classifyCandidateSignal, rankEvidenceItems, resolveEvidenceEnclosingLabel } from '../data/evidenceSignal.js';
import './service.css';
import './service-layout.css';

import { RelationshipEditor, RecordRevision, ServiceSearch, ServiceGraph, CycleActions } from './ServiceTools.jsx';
import { buildImpactGraphData } from '../data/impactGraph.js';

const TraceabilityFlow = lazy(() => import('./TraceabilityFlow.jsx'));

const VALIDITY_HINTS = {
  candidate: 'Unconfirmed link awaiting human inspection of exact evidence',
  stale: 'Previously confirmed link whose endpoint changed in this revision; needs reconfirmation or retirement',
  confirmed: 'Confirmed by an authorized reviewer against exact snapshot evidence',
  rejected: 'Rejected as unrelated or insufficient evidence',
  retired: 'Retired after endpoint removal or invalidated continuity',
};

function ValidityIcon({ validity, size = 11 }) {
  if (validity === 'confirmed') return <CheckCircle2 size={size} aria-hidden="true" />;
  if (validity === 'stale') return <AlertTriangle size={size} aria-hidden="true" />;
  if (validity === 'candidate') return <Clock size={size} aria-hidden="true" />;
  if (validity === 'retired') return <Archive size={size} aria-hidden="true" />;
  return <X size={size} aria-hidden="true" />;
}

function ValidityChip({ validity }) {
  return (
    <Tooltip content={VALIDITY_HINTS[validity] || `Validity: ${validity}`}>
      <span className={`service-chip service-chip--${validity}`} data-validity={validity}>
        <ValidityIcon validity={validity} />
        {validity}
      </span>
    </Tooltip>
  );
}

function DecisionIcon({ decision, size = 13 }) {
  if (decision === 'confirm') return <CheckCircle2 size={size} aria-hidden="true" />;
  if (decision === 'reconfirm') return <RefreshCw size={size} aria-hidden="true" />;
  if (decision === 'retire') return <Archive size={size} aria-hidden="true" />;
  return <X size={size} aria-hidden="true" />;
}

const DECISION_HINTS = {
  confirm: 'Confirm that the exact cited evidence supports this relationship',
  reject: 'Dismiss as false or unrelated suggestion',
  reconfirm: 'Reconfirm that this link remains valid after incoming changes',
  retire: 'Retire link because it no longer applies to the incoming revision',
};

const RELATION_HINTS = {
  documents: 'Document describes or specifies behavior in Python code',
  depends_on: 'Declares a package, runtime, or configuration dependency required by code',
  implements: 'Python code implements a tracked requirement',
  motivates: 'Architectural decision motivates Python code',
};

const ARTIFACT_KIND_LABELS = {
  code: 'Code',
  document: 'Document',
  requirement: 'Requirement',
  decision: 'Decision',
};

function ArtifactKindIcon({ kind, size = 15, className = '' }) {
  if (kind === 'code') return <FileCode2 size={size} className={className} />;
  if (kind === 'decision') return <GitBranch size={size} className={className} />;
  if (kind === 'requirement') return <ListChecks size={size} className={className} />;
  return <FileText size={size} className={className} />;
}

function Login({ ctx }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="entry-page service-entry"><header className="entry-brand"><InfinityIcon size={30} strokeWidth={1.5} /><span>Continuum</span></header><div className="entry-layout">
    <section className="auth-panel"><h1>Welcome back to Continuum.</h1><p>Sign in with the account provided by your team.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await ctx.signIn(login, password); } catch (err) { setError(err.message); } finally { setPassword(''); setBusy(false); } }}>
      <div className="journey-field"><label htmlFor="service-login-username">Login</label><Input id="service-login-username" autoComplete="username" required value={login} onChange={e => setLogin(e.target.value)} placeholder="Enter your username" /></div>
      <div className="journey-field"><label htmlFor="service-login-password">Password</label><div className="password-field"><Input id="service-login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /><Button variant="unstyled" type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></div></div>
      {(error || ctx.error) && <p className="form-error" role="alert">{error || ctx.error}</p>}
      <Button variant="unstyled" type="submit" className="btn btn--accent auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></Button>
    </form><p className="auth-demo-link"><a className="text-link" href="?mode=demo">Open the sample-data demo <ArrowRight size={13} aria-hidden="true" /></a></p></section>
    <section className="service-entry-guide" aria-labelledby="entry-guide-title">
      <h2 id="entry-guide-title">Review what changed</h2>
      <ol>
        <li><GitCompare size={20} aria-hidden="true" /><div><strong>Compare revisions</strong><p>See which files changed between two captured commits.</p></div></li>
        <li><Network size={20} aria-hidden="true" /><div><strong>Trace the impact</strong><p>Find the linked docs, code and decisions that need another look.</p></div></li>
        <li><ListChecks size={20} aria-hidden="true" /><div><strong>Record the outcome</strong><p>Save your judgment with the evidence you reviewed.</p></div></li>
      </ol>
    </section>
  </div></main>;
}

function HighlightExcerpt({ text, tokens = [] }) {
  if (!text || !tokens.length) return <pre className="service-excerpt">{text}</pre>;
  const escaped = tokens
    .filter(Boolean)
    .map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return <pre className="service-excerpt">{text}</pre>;
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = String(text).split(pattern);
  const tokenSet = new Set(tokens.map(t => t.toLowerCase()));
  return (
    <pre className="service-excerpt">
      {parts.map((part, idx) =>
        tokenSet.has(part.toLowerCase()) ? <mark key={idx} className="service-token-mark">{part}</mark> : part
      )}
    </pre>
  );
}

function EndpointDiffBox({ label, path, beforeText, afterText, deleted = false }) {
  const diff = useMemo(() => computeLineDiff(beforeText || '', afterText || ''), [beforeText, afterText]);
  if (deleted) {
    return (
      <div className="service-diff-box">
        <div className="service-diff-head"><strong>{label}: {path}</strong><span className="service-diff-stats is-removed">Removed in target revision</span></div>
        <p className="service-method">This artifact was absent in the target snapshot; earlier content is kept for inspection.</p>
      </div>
    );
  }
  if (diff.identical) {
    return (
      <div className="service-diff-box">
        <div className="service-diff-head"><strong>{label}: {path}</strong><span className="service-diff-stats">Unchanged lines</span></div>
      </div>
    );
  }
  return (
    <div className="service-diff-box">
      <div className="service-diff-head">
        <strong>{label}: {path}</strong>
        <span className="service-diff-counts">
          {diff.added > 0 && <span className="service-diff-badge is-added">+{diff.added}</span>}
          {diff.removed > 0 && <span className="service-diff-badge is-removed">-{diff.removed}</span>}
        </span>
      </div>
      <div className="service-diff-body">
        {diff.hunks.map((hunk, hi) => (
          <div className="service-diff-hunk" key={hi}>
            <div className="service-diff-hunk__head">{hunk.header}</div>
            {hunk.lines.map((line, li) => (
              <div className={`service-diff-line is-${line.type}`} key={li}>
                <span className="service-diff-num">{line.oldLine ?? ''}</span>
                <span className="service-diff-num">{line.newLine ?? ''}</span>
                <span className="service-diff-sign">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</span>
                <code>{line.text || ' '}</code>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLocator(locator) {
  if (locator?.kind === 'lines') return locator.startLine === locator.endLine ? `Line ${locator.startLine}` : `Lines ${locator.startLine}–${locator.endLine}`;
  if (locator?.kind === 'field') return `Field · ${locator.fieldPath || 'path'}`;
  return 'Source anchor';
}

function CommitDiffDialog({ ctx, commitRequest, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!commitRequest?.commitId) return;
    const abort = new AbortController();
    ctx.api
      .gitCommitDetail(ctx.selection.repositoryId, commitRequest.commitId, commitRequest.path || null, abort.signal)
      .then(data => { if (!abort.signal.aborted) { setDetail(data); setLoading(false); } })
      .catch(e => { if (!abort.signal.aborted && e.name !== 'AbortError') { setErr(e.message); setLoading(false); } });
    return () => abort.abort();
  }, [ctx.api, ctx.selection.repositoryId, commitRequest]);

  if (!commitRequest) return null;
  const commit = detail?.commit;
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="service-dialog service-commit-diff-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="gitlens-commit-title" aria-describedby="gitlens-commit-desc">
        <div className="service-dialog-head">
          <div>
            <DialogTitle id="gitlens-commit-title">
              GitLens Commit Inspector · <code>{commitRequest.commitId.slice(0, 7)}</code>
            </DialogTitle>
            <DialogDescription id="gitlens-commit-desc">
              {commitRequest.path ? `Scoped to ${commitRequest.path}` : 'Full commit metadata and unified diff'}
            </DialogDescription>
          </div>
          <Button variant="unstyled" className="btn service-dialog-close" onClick={onClose} aria-label="Close commit inspector"><X size={18} /></Button>
        </div>
        <div className="service-dialog-body">
          {loading && <p className="service-method" role="status">Loading commit metadata &amp; diff from Git…</p>}
          {err && <p className="form-error" role="alert">{err}</p>}
          {!loading && !err && commit && (
            <div className="service-commit-inspector">
              <div className="service-commit-inspector__meta">
                <h3 className="service-commit-inspector__subject">{commit.subject}</h3>
                {commit.body && <pre className="service-commit-inspector__body">{commit.body}</pre>}
                <div className="service-commit-inspector__facts">
                  <span><strong>Author:</strong> {commit.authorName} {commit.authorEmail ? `<${commit.authorEmail}>` : ''}</span>
                  <span><strong>Authored:</strong> {formatTimestamp(commit.authoredAt)}</span>
                  <span><strong>Commit SHA:</strong> <code>{commit.commitId}</code></span>
                  {commit.parentIds?.length > 0 && <span><strong>Parent:</strong> <code>{commit.parentIds.map(p => p.slice(0, 7)).join(', ')}</code></span>}
                </div>
              </div>
              {detail.changedFiles?.length > 0 && (
                <Disclosure trigger={`Files modified in commit (${detail.changedFiles.length})`} defaultOpen={detail.changedFiles.length <= 8} variant="subtle">
                  <div className="service-impact-strip">
                    {detail.changedFiles.map(f => (
                      <span className="service-change-pill" key={f.path}>
                        <code>{f.status}</code>
                        <span>{f.path}</span>
                      </span>
                    ))}
                  </div>
                </Disclosure>
              )}
              <div className="service-commit-diff-box">
                <div className="service-diff-head">
                  <strong>Unified Git diff {detail.scopedPath ? `(${detail.scopedPath})` : ''}</strong>
                  {detail.truncated && <small>Truncated at 200 KB</small>}
                </div>
                <pre className="service-git-unified-diff">
                  {(detail.diff || 'No line changes for this path in this commit.').split('\n').map((dline, idx) => {
                    const cls = dline.startsWith('+') && !dline.startsWith('+++')
                      ? 'is-add'
                      : dline.startsWith('-') && !dline.startsWith('---')
                        ? 'is-del'
                        : dline.startsWith('@@')
                          ? 'is-hunk'
                          : '';
                    return <div className={`service-git-diff-line ${cls}`} key={idx}>{dline || ' '}</div>;
                  })}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="service-dialog-footer">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildLineBlameLookup(blame) {
  if (!blame?.available || !blame?.hunks?.length || !blame?.commits) return null;
  const byLine = new Map();
  for (const hunk of blame.hunks) {
    const commit = blame.commits[hunk.commitId];
    if (!commit) continue;
    for (let ln = hunk.startLine; ln <= hunk.endLine; ln += 1) {
      byLine.set(ln, {
        commit,
        isHunkStart: ln === hunk.startLine,
        hunkStart: hunk.startLine,
        hunkEnd: hunk.endLine,
      });
    }
  }
  return byLine;
}

function Source({
  source,
  defaultOpen = true,
  open,
  onOpenChange,
  selectedRange = null,
  onSelectLine = null,
  bodyRef = null,
  tone = 'dark',
  jumpLine = null,
  blame = null,
  defaultShowBlame = false,
  onInspectCommit = null,
}) {
  const [copied, setCopied] = useState(false);
  const [showBlame, setShowBlame] = useState(defaultShowBlame);
  const localBodyRef = useRef(null);
  const resolvedRef = bodyRef || localBodyRef;
  const lineBlame = useMemo(() => buildLineBlameLookup(blame), [blame]);
  useEffect(() => {
    if (!open || !jumpLine) return;
    const raf = requestAnimationFrame(() => {
      const row = resolvedRef.current?.querySelector(`[data-line="${jumpLine}"]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, jumpLine, resolvedRef]);
  if (!source) return <p>Exact source is unavailable.</p>;
  const path = source.identity.path || source.identity.title || source.id;
  const lines = source.content.split('\n');
  const disclosureVariant = tone === 'quiet' ? 'subtle' : 'dark';
  const copySource = async () => {
    try {
      await navigator.clipboard?.writeText(source.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard permission optional */ }
  };
  const blameActive = Boolean(showBlame && lineBlame);
  return <section className={`code-box service-source ${tone === 'quiet' ? 'is-quiet' : ''} ${blameActive ? 'has-gitlens-blame' : ''}`}>
    <div className="code-box__header">
      <FileCode2 size={14} />
      <strong title={path}>{path}</strong>
      <span>{lines.length} lines</span>
      {blame?.available && (
        <span className="service-source-gitlens-stats" title={`${blame.contributorCount} contributor(s) across ${blame.distinctCommits} commit(s)`}>
          <GitCommit size={12} aria-hidden="true" />
          {blame.contributorCount} {blame.contributorCount === 1 ? 'author' : 'authors'} · {blame.distinctCommits} {blame.distinctCommits === 1 ? 'commit' : 'commits'}
        </span>
      )}
      {blame?.available && (
        <button
          type="button"
          className={`service-source-blame-toggle ${showBlame ? 'is-active' : ''}`}
          onClick={() => setShowBlame(v => !v)}
          aria-pressed={showBlame}
        >
          <GitBranch size={12} aria-hidden="true" />
          <span>{showBlame ? 'Hide GitLens blame' : 'GitLens blame'}</span>
        </button>
      )}
      <button type="button" className="service-source-copy" onClick={copySource} aria-label={`Copy ${path}`}>{copied ? <Check size={12} /> : <Copy size={12} />}<span>{copied ? 'Copied' : 'Copy'}</span></button>
    </div>
    <Disclosure trigger="Read captured source" defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange} variant={disclosureVariant} className="service-source-content">
      <div className="code-box__body" ref={resolvedRef}>{lines.map((line, i) => {
        const lineNo = i + 1;
        const inRange = selectedRange && lineNo >= selectedRange[0] && lineNo <= selectedRange[1];
        const bInfo = blameActive ? lineBlame.get(lineNo) : null;
        const bCommit = bInfo?.commit;
        const showAnnotation = bCommit && (bInfo.isHunkStart || (selectedRange && lineNo === selectedRange[0]));
        const shortDate = (bCommit?.authoredAt || '').slice(0, 10);
        const blameTooltip = bCommit
          ? `${bCommit.authorName}${bCommit.authorEmail ? ` <${bCommit.authorEmail}>` : ''} · ${shortDate} · ${bCommit.shortCommitId}\n"${bCommit.summary}" (Lines ${bInfo.hunkStart}–${bInfo.hunkEnd})`
          : '';
        return <div
          className={`code-line ${onSelectLine ? 'is-selectable' : ''} ${inRange ? 'is-selected-line' : ''} ${bInfo?.isHunkStart ? 'is-blame-hunk-start' : ''}`}
          data-line={lineNo}
          key={i}
          onClick={onSelectLine ? e => onSelectLine(lineNo, e) : undefined}
        >
          {blameActive && (
            <button
              type="button"
              className={`code-line__blame ${showAnnotation ? 'has-label' : 'is-continuation'}`}
              title={blameTooltip}
              onClick={e => {
                e.stopPropagation();
                if (bCommit && onInspectCommit) onInspectCommit({ commitId: bCommit.commitId, path });
              }}
            >
              {showAnnotation ? (
                <>
                  <span className="code-line__blame-author">{bCommit.authorName}</span>
                  <span className="code-line__blame-date">{shortDate}</span>
                  <code className="code-line__blame-sha">{bCommit.shortCommitId}</code>
                  <span className="code-line__blame-msg">{bCommit.summary}</span>
                </>
              ) : (
                <span className="code-line__blame-bar" aria-hidden="true">│</span>
              )}
            </button>
          )}
          <span className="code-line__num">{lineNo}</span>
          <span className="code-line__text">{line || ' '}</span>
        </div>;
      })}</div>
    </Disclosure>
    <Disclosure trigger="Exact version identity" variant={disclosureVariant} className="service-source-identity">
      <pre className="service-json">{JSON.stringify({ id: source.id, identity: source.identity, digest: source.contentDigest }, null, 2)}</pre>
    </Disclosure>
  </section>;
}

function BatchConfirmDialog({ ctx, rows, onClose, onCompleted }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [reason, setReason] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    ctx.loadBatchEvidence(rows, abort.signal)
      .then(data => { if (!abort.signal.aborted) { setItems(data); setLoading(false); } })
      .catch(e => { if (!abort.signal.aborted && e.name !== 'AbortError') { setLoadError(e.message); setLoading(false); } });
    return () => abort.abort();
  }, [ctx, rows]);

  const checkedItems = items.filter(({ row }) => checkedIds.has(row.id));
  const allInspected = items.length > 0 && checkedItems.length === items.length;
  const toggleItemChecked = (id, checked) => setCheckedIds(prev => {
    const next = new Set(prev);
    if (checked) next.add(id);
    else next.delete(id);
    return next;
  });
  const toggleAllChecked = checked => {
    setCheckedIds(checked ? new Set(items.map(({ row }) => row.id)) : new Set());
  };

  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="service-dialog service-batch-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="batch-confirm-title" aria-describedby="batch-confirm-desc">
      <div className="service-dialog-head">
        <div>
          <DialogTitle id="batch-confirm-title">Review &amp; confirm {rows.length} relationships</DialogTitle>
          <DialogDescription id="batch-confirm-desc">Inspect each relationship’s recorded evidence and check the ones you verified. Unchecked items remain candidates.</DialogDescription>
        </div>
        <Button variant="unstyled" className="btn service-dialog-close" onClick={onClose} aria-label="Close batch review"><X size={18} /></Button>
      </div>
      {loading && <div className="service-dialog-body"><p className="service-method" role="status">Loading exact recorded evidence…</p></div>}
      {loadError && <div className="service-dialog-body"><p className="form-error" role="alert">{loadError}</p></div>}
      {!loading && !loadError && <form className="service-dialog-form" onSubmit={async e => {
        e.preventDefault();
        if (!checkedItems.length) return;
        const res = await ctx.submitBatchJudgments(checkedItems, { decision: 'confirm', reason });
        if (res.succeeded > 0) onCompleted(checkedItems.map(({ row }) => row.id));
        onClose();
      }}>
        <div className="service-dialog-body journey-form">
          <div className="service-batch-evidence-list">
            {items.map(({ row, totalEvidence, evidence }) => <section className={`service-batch-item ${checkedIds.has(row.id) ? 'is-checked' : ''}`} key={row.id}>
              <div className="service-batch-item__head">
                <strong>{row.sourceLabel || row.sourcePath}</strong>
                <span><span className="service-rel-tag">{row.assertion.type}</span> → {row.targetLabel || row.targetPath}</span>
                <small>{totalEvidence} anchor{totalEvidence === 1 ? '' : 's'}</small>
              </div>
              {evidence.map(ev => <div className="service-batch-excerpt" key={ev.id}>
                <small>{formatLocator(ev.locator)}</small>
                <pre className="service-excerpt">{ev.excerpt ?? ev.reason ?? 'No resolvable excerpt.'}</pre>
              </div>)}
              <label className="service-checkbox service-batch-item__check">
                <Checkbox checked={checkedIds.has(row.id)} onChange={e => toggleItemChecked(row.id, e.target.checked)} />
                <span>Inspected recorded evidence for {row.sourceLabel || row.sourcePath} → {row.targetLabel || row.targetPath}</span>
              </label>
            </section>)}
          </div>
          <label className="service-checkbox"><Checkbox checked={allInspected} onChange={e => toggleAllChecked(e.target.checked)} />Mark all {items.length} loaded relationships inspected ({checkedItems.length} of {items.length} checked).</label>
          <label>Reason (optional)<Textarea rows={2} value={reason} maxLength={4000} placeholder="Shared rationale applied only to checked confirmations (optional)…" onChange={e => setReason(e.target.value)} /></label>
        </div>
        <div className="service-dialog-footer">
          <Button type="submit" disabled={!ctx.canWrite || ctx.busy || !checkedItems.length}>Confirm {checkedItems.length} relationship{checkedItems.length === 1 ? '' : 's'}</Button>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>;
}

const TRIAGE_LABELS = { defer: 'Defer', screen: 'Screen out', restore: 'Restore to open queue' };

function rowPriorityRank(row, signalMap) {
  if (row.projection.validity === 'stale' && row.projection.resolution === 'open') return 0;
  if (row.projection.resolution === 'open') {
    const tier = signalMap.get(row.id)?.tier || 'moderate';
    return tier === 'high' ? 1 : tier === 'moderate' ? 2 : 3;
  }
  if (row.projection.resolution === 'deferred') return 4;
  if (row.projection.resolution === 'screened') return 5;
  return 6;
}

function Relationships({ ctx, onSelect, heading = true }) {
  const [search, setSearch] = useState('');
  const [localTab, setLocalTab] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [signalFilter, setSignalFilter] = useState('all');
  const [hideLowSignal, setHideLowSignal] = useState(false);
  const [viewMode, setViewMode] = useState(heading ? 'grouped' : 'flat');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const activeTab = heading ? (ctx.state.queueTab || localTab) : 'all';
  const selectTaskTab = nextTab => {
    setLocalTab(nextTab);
    if (ctx.state.queueTab) {
      ctx.setState(s => ({ ...s, queueTab: null }));
    }
  };

  const signalMap = useMemo(() => {
    const map = new Map();
    for (const row of ctx.rows) {
      map.set(row.id, classifyCandidateSignal(row, ctx.rows));
    }
    return map;
  }, [ctx.rows]);

  const rows = ctx.rows
    .filter(r => {
      const matchesSearch = `${r.sourcePath} ${r.targetPath} ${r.sourceLabel || ''} ${r.targetLabel || ''} ${r.assertion.methodId} ${r.assertion.type}`.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === 'all'
        || (activeTab === 'attention' && r.projection.validity === 'stale')
        || (activeTab === 'suggestions' && r.projection.validity === 'candidate' && r.projection.resolution === 'open')
        || (activeTab === 'triaged' && ['deferred', 'screened'].includes(r.projection.resolution))
        || (activeTab === 'reviewed' && r.projection.resolution === 'resolved');
      const matchesReview = reviewFilter === 'all'
        || (reviewFilter === 'triaged' ? ['deferred', 'screened'].includes(r.projection.resolution) : r.projection.resolution === reviewFilter);
      const tier = signalMap.get(r.id)?.tier || 'moderate';
      const matchesSignal = signalFilter === 'all'
        || (signalFilter === 'high_moderate' ? tier !== 'low' : tier === signalFilter);
      const matchesNoiseToggle = !hideLowSignal || signalFilter === 'low' || tier !== 'low' || r.projection.validity !== 'candidate' || r.projection.resolution !== 'open';
      return matchesSearch && matchesTab && matchesReview && matchesSignal && matchesNoiseToggle;
    })
    .sort((a, b) => rowPriorityRank(a, signalMap) - rowPriorityRank(b, signalMap));
  const visibleIdsKey = rows.map(r => r.id).join(',');
  useEffect(() => {
    const ids = visibleIdsKey ? visibleIdsKey.split(',') : [];
    if (!ids.length || !heading) return;
    const handler = e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase() || '';
      if (['input', 'textarea', 'select'].includes(tag) || active?.isContentEditable) return;
      const role = active?.getAttribute?.('role');
      if (['combobox', 'tab', 'option', 'menuitem'].includes(role)) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      e.preventDefault();
      const idx = ids.indexOf(ctx.state.selectedArtifactId);
      const nextIdx = e.key === 'ArrowDown'
        ? (idx >= 0 && idx < ids.length - 1 ? idx + 1 : 0)
        : (idx > 0 ? idx - 1 : ids.length - 1);
      ctx.selectArtifact(ids[nextIdx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visibleIdsKey, ctx, heading]);

  const totalCount = ctx.rows.length;
  const openCount = ctx.rows.filter(r => r.projection.resolution === 'open').length;
  const staleCount = ctx.rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open').length;
  const openSuggestionCount = ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open').length;
  const confirmedCount = ctx.rows.filter(r => r.projection.validity === 'confirmed').length;
  const rejectedCount = ctx.rows.filter(r => r.projection.validity === 'rejected').length;
  const retiredCount = ctx.rows.filter(r => r.projection.validity === 'retired').length;
  const deferredCount = ctx.rows.filter(r => r.projection.resolution === 'deferred').length;
  const screenedCount = ctx.rows.filter(r => r.projection.resolution === 'screened').length;
  const triagedCount = deferredCount + screenedCount;
  const resolvedCount = ctx.rows.filter(r => r.projection.resolution === 'resolved').length;
  const lowSignalTotalCount = ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open' && signalMap.get(r.id)?.tier === 'low').length;
  const isTriageCandidate = r => r.projection.validity === 'candidate' && ['open', 'deferred', 'screened'].includes(r.projection.resolution);
  const canBatch = heading && ctx.canWrite && ctx.workspace?.mode === 'active';
  const eligibleCandidates = canBatch ? rows.filter(isTriageCandidate) : [];
  const openEligible = eligibleCandidates.filter(r => r.projection.resolution === 'open');
  const lowSignalEligible = openEligible.filter(r => signalMap.get(r.id)?.tier === 'low');
  const hiddenByFilter = totalCount - rows.length;
  const selectedRows = eligibleCandidates.filter(r => selectedIds.has(r.id));
  const allEligibleSelected = eligibleCandidates.length > 0 && selectedRows.length === eligibleCandidates.length;
  const changedPaths = new Set(ctx.workspace?.comparison?.changes.map(change => change.path) || []);

  const toggleSelect = id => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectGroup = groupRows => {
    const groupEligible = groupRows.filter(isTriageCandidate);
    if (!groupEligible.length) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allIn = groupEligible.every(r => next.has(r.id));
      for (const r of groupEligible) {
        if (allIn) next.delete(r.id); else next.add(r.id);
      }
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleCandidates.map(r => r.id)));
  };

  // Group rows by source artifact label/path, ordered by highest-priority item
  const grouped = [];
  const bySource = new Map();
  for (const row of rows) {
    const key = row.source?.artifactId || row.sourcePath;
    if (!bySource.has(key)) {
      const entry = { key, title: row.sourceLabel || row.sourcePath, kind: row.source?.kind, items: [] };
      bySource.set(key, entry);
      grouped.push(entry);
    }
    bySource.get(key).items.push(row);
  }

  const renderRow = row => {
    const selectable = canBatch && isTriageCandidate(row);
    const evCount = row.assertion?.evidenceIds?.length || 0;
    const isStale = row.projection.validity === 'stale';
    const changedSource = changedPaths.has(row.sourcePath);
    const changedTarget = changedPaths.has(row.targetPath);
    const changedEndpoint = changedSource && changedTarget ? 'Both files changed'
      : changedSource ? 'Source file changed'
      : changedTarget ? 'Target file changed'
      : '';
    const sig = signalMap.get(row.id);
    const isLowSignal = row.projection.validity === 'candidate' && row.projection.resolution === 'open' && sig?.tier === 'low';
    const pairLabel = `${row.sourceLabel || row.sourcePath} to ${row.targetLabel || row.targetPath}`;
    return <div className={`service-row-wrap ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''} ${isStale ? 'is-impacted' : ''} ${isLowSignal ? 'is-low-signal' : ''}`} key={row.id}>
      {selectable && <div className="service-row-check"><Checkbox aria-label={`Select ${pairLabel}`} checked={selectedIds.has(row.id)} disabled={ctx.busy} onChange={() => toggleSelect(row.id)} /></div>}
      <Button variant="unstyled" className={`service-row ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''}`} onClick={() => { ctx.selectArtifact(row.id); onSelect?.(); }} disabled={ctx.busy}>
        <ArtifactKindIcon kind={viewMode === 'grouped' ? row.target?.kind : row.source?.kind} size={16} className="service-row-icon" />
        <span className="service-row-paths">
          {viewMode === 'grouped' ? (
            <>
              <strong title={row.targetPath}>
                <span className="sr-only">{row.sourceLabel || row.sourcePath} </span>
                <span className="service-rel-tag">{row.assertion.type}</span>
                <ArrowRight size={11} className="service-inline-arrow" aria-hidden="true" />
                {row.targetLabel || row.targetPath}
              </strong>
              <small title={row.targetPath?.startsWith('authored/') ? `${row.targetLabel} (authored ${row.target?.kind || 'record'})` : row.targetPath} className="service-row-target">
                {row.targetLabel && row.targetLabel !== row.targetPath && <span>{row.targetPath?.startsWith('authored/') ? (ARTIFACT_KIND_LABELS[row.target?.kind] || 'Authored record') : row.targetPath}</span>}
                {evCount > 0 && <span className="service-anchor-count" title={`${evCount} evidence anchor${evCount === 1 ? '' : 's'}`}><Link2 size={10} aria-hidden="true" />{evCount}</span>}
                {sig && <Tooltip content={sig.reason}><span className={`service-signal-badge is-${sig.tier}`}>{sig.label}</span></Tooltip>}
                {isStale && changedEndpoint && <span className="service-stale-cue">{changedEndpoint}</span>}
              </small>
            </>
          ) : (
            <>
              <strong title={row.sourcePath}>{row.sourceLabel || row.sourcePath}</strong>
              <small title={row.targetPath} className="service-row-target">
                <span className="service-rel-tag">{row.assertion.type}</span>
                <ArrowRight size={11} aria-hidden="true" />
                <ArtifactKindIcon kind={row.target?.kind} size={12} className="service-row-target-icon" />
                <span>{row.targetLabel || row.targetPath}</span>
                {evCount > 0 && <span className="service-anchor-count" title={`${evCount} evidence anchor${evCount === 1 ? '' : 's'}`}><Link2 size={10} aria-hidden="true" />{evCount}</span>}
                {sig && <Tooltip content={sig.reason}><span className={`service-signal-badge is-${sig.tier}`}>{sig.label}</span></Tooltip>}
                {isStale && changedEndpoint && <span className="service-stale-cue">{changedEndpoint}</span>}
              </small>
            </>
          )}
        </span>
        <span className="service-row-status"><ValidityChip validity={row.projection.validity} /><small>{row.projection.resolution === 'screened' ? 'screened out' : row.projection.resolution}</small></span>
        <ChevronRight size={15} className="service-row-arrow" />
      </Button>
      {selectable && <div className="service-row-triage-actions">
        {row.projection.resolution !== 'deferred' && <Tooltip content="Defer suggestion to revisit later (retains candidate state)">
          <Button variant="ghost" size="xs" className="service-row-dismiss" disabled={ctx.busy} aria-label={`Defer ${pairLabel}`} onClick={() => ctx.triageCandidate(row, 'defer')}>Defer</Button>
        </Tooltip>}
        {row.projection.resolution !== 'screened' && <Tooltip content="Screen out suggestion without recording a formal rejection">
          <Button variant="ghost" size="xs" className="service-row-dismiss" disabled={ctx.busy} aria-label={`Screen out ${pairLabel}`} onClick={() => ctx.triageCandidate(row, 'screen')}>Screen out</Button>
        </Tooltip>}
        {row.projection.resolution !== 'open' && <Tooltip content="Restore suggestion back to the active queue">
          <Button variant="ghost" size="xs" className="service-row-dismiss" disabled={ctx.busy} aria-label={`Restore ${pairLabel}`} onClick={() => ctx.triageCandidate(row, 'restore')}>Restore</Button>
        </Tooltip>}
      </div>}
    </div>;
  };

  const taskTabs = [
    { id: 'all', label: 'All', count: totalCount },
    { id: 'attention', label: 'Needs attention', count: staleCount, warn: staleCount > 0 },
    { id: 'suggestions', label: 'Suggestions', count: openSuggestionCount },
    { id: 'triaged', label: 'Deferred & screened', count: triagedCount },
    { id: 'reviewed', label: 'Reviewed', count: resolvedCount },
  ];

  const emptyMessage = activeTab === 'attention'
    ? { title: 'No stale relationships need revalidation', body: 'Previously confirmed relationships are unaffected by revision changes in this view.' }
    : activeTab === 'suggestions'
      ? { title: 'No open suggestions in this filter', body: 'Switch to All or Deferred & screened to inspect previously triaged or reviewed items.' }
      : activeTab === 'triaged'
        ? { title: 'No deferred or screened suggestions', body: 'Defer or screen out candidates from the active list to park low-priority items without recording false rejections.' }
        : activeTab === 'reviewed'
          ? { title: 'No formally reviewed relationships yet', body: 'Reviewing automated suggestions is optional; inspect and confirm key links when ready.' }
          : { title: 'No matching relationships', body: 'Try clearing search text or switching task and signal filters.' };

  return <section className="service-relationships">
    {heading && <div className="service-section-heading">
      <div>
        <h2>Relationships <span>{rows.length}</span></h2>
        <div className="service-queue-pills">
          {staleCount > 0 && (
            <Tooltip content="Previously confirmed relationships affected by changes; require reconfirmation or retirement">
              <span className="service-metric-pill is-warn"><AlertTriangle size={12} aria-hidden="true" />{staleCount} stale</span>
            </Tooltip>
          )}
          <Tooltip content="Human-confirmed relationships in this snapshot">
            <span className="service-metric-pill is-accent"><CheckCircle2 size={12} aria-hidden="true" />{confirmedCount} confirmed</span>
          </Tooltip>
          {rejectedCount > 0 && (
            <Tooltip content="Formally rejected suggestions">
              <span className="service-metric-pill">{rejectedCount} rejected</span>
            </Tooltip>
          )}
          {retiredCount > 0 && (
            <Tooltip content="Retired relationships">
              <span className="service-metric-pill">{retiredCount} retired</span>
            </Tooltip>
          )}
          {openSuggestionCount > 0 && (
            <Tooltip content="Unconfirmed candidate relationships awaiting optional inspection">
              <span className="service-metric-pill"><Clock size={12} aria-hidden="true" />{openSuggestionCount} open suggestions</span>
            </Tooltip>
          )}
          {deferredCount > 0 && (
            <Tooltip content="Candidates deferred for later review">
              <span className="service-metric-pill">{deferredCount} deferred</span>
            </Tooltip>
          )}
          {screenedCount > 0 && (
            <Tooltip content="Candidates screened out from active queue without formal rejection">
              <span className="service-metric-pill">{screenedCount} screened out</span>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="service-heading-actions">
        <div className="service-view-toggle" role="group" aria-label="Queue layout">
          <Tooltip content="Group relationships by source file">
            <button type="button" className={viewMode === 'grouped' ? 'is-active' : ''} onClick={() => setViewMode('grouped')}><Layers size={12} aria-hidden="true" /> Grouped</button>
          </Tooltip>
          <Tooltip content="Flat list of all relationships">
            <button type="button" className={viewMode === 'flat' ? 'is-active' : ''} onClick={() => setViewMode('flat')}><List size={12} aria-hidden="true" /> Flat</button>
          </Tooltip>
        </div>
        <RelationshipEditor ctx={ctx} />
        {openCount > 0 && <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={() => ctx.selectNextOpen(ctx.state.selectedArtifactId)}>{staleCount > 0 ? `Review next stale (${staleCount})` : `Review next suggestion (${openCount})`} <ArrowRight size={14} /></Button>}
      </div>
    </div>}
    {heading && totalCount > 0 && (
      <div className="service-task-tabs" role="tablist" aria-label="Queue focus views">
        {taskTabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`service-task-tab ${activeTab === t.id ? 'is-active' : ''} ${t.warn ? 'is-warn' : ''}`}
            onClick={() => selectTaskTab(t.id)}
          >
            <span>{t.label}</span>
            <span className="service-task-tab__count">{t.count}</span>
          </button>
        ))}
      </div>
    )}
    <div className="service-filters">
      <label className="service-search-field">Search relationships<Input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by path or type…" /></label>
      <label className="service-validity-field">Review state<Select aria-label="Filter by review state" value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}><option value="all">all</option><option value="open">open</option><option value="deferred">deferred</option><option value="screened">screened</option><option value="triaged">triaged (deferred &amp; screened)</option><option value="resolved">resolved</option></Select></label>
      <label className="service-validity-field">Signal tier<Select aria-label="Filter by signal tier" value={signalFilter} onChange={e => setSignalFilter(e.target.value)}><option value="all">All signals</option><option value="high_moderate">High &amp; moderate</option><option value="high">High only</option><option value="low">Low signal only</option></Select></label>
      {lowSignalTotalCount > 0 && signalFilter !== 'low' && (
        <button
          type="button"
          className={`service-noise-toggle ${hideLowSignal ? 'is-active' : ''}`}
          aria-pressed={hideLowSignal}
          onClick={() => setHideLowSignal(v => !v)}
          title="Hide low-signal lexical overlap suggestions from the active view without altering data"
        >
          {hideLowSignal ? `Showing high/moderate (${lowSignalTotalCount} low hidden)` : `Hide low-signal (${lowSignalTotalCount})`}
        </button>
      )}
    </div>
    {hiddenByFilter > 0 && <p className="service-method service-filter-disclosure" role="status">Showing {rows.length} of {totalCount} relationships ({hiddenByFilter} filtered; {staleCount > 0 ? `${staleCount} stale review${staleCount === 1 ? '' : 's'} remain required; ` : ''}{openCount} open &amp; {triagedCount} triaged candidates remain unresolved).</p>}
    {canBatch && eligibleCandidates.length > 0 && <div className="service-batch-bar">
      <div className="service-batch-left">
        <label className="service-checkbox service-batch-selectall"><Checkbox checked={allEligibleSelected} disabled={ctx.busy} onChange={toggleSelectAll} /><span>{openEligible.length === eligibleCandidates.length ? `Select all open candidates (${eligibleCandidates.length})` : `Select all visible candidates (${eligibleCandidates.length})`}</span></label>
        {lowSignalEligible.length > 0 && <Button variant="ghost" size="xs" disabled={ctx.busy} onClick={() => setSelectedIds(new Set(lowSignalEligible.map(r => r.id)))}>Select low-signal ({lowSignalEligible.length})</Button>}
      </div>
      {selectedRows.length > 0 && <div className="service-batch-actions">
        <span className="service-batch-count">{selectedRows.length} selected</span>
        <Button variant="default" size="xs" disabled={ctx.busy} onClick={() => setBatchConfirmOpen(true)}>Review &amp; confirm ({selectedRows.length})</Button>
        {selectedRows.some(r => r.projection.resolution !== 'deferred') && <Button variant="secondary" size="xs" disabled={ctx.busy} onClick={async () => { const targets = selectedRows.filter(r => r.projection.resolution !== 'deferred'); const res = await ctx.submitBatchTriage(targets, { disposition: 'defer' }); if (res.succeeded > 0) setSelectedIds(new Set()); }}>Defer selected ({selectedRows.filter(r => r.projection.resolution !== 'deferred').length})</Button>}
        {selectedRows.some(r => r.projection.resolution !== 'screened') && <Button variant="secondary" size="xs" disabled={ctx.busy} onClick={async () => { const targets = selectedRows.filter(r => r.projection.resolution !== 'screened'); const res = await ctx.submitBatchTriage(targets, { disposition: 'screen' }); if (res.succeeded > 0) setSelectedIds(new Set()); }}>Screen out selected ({selectedRows.filter(r => r.projection.resolution !== 'screened').length})</Button>}
        {selectedRows.some(r => r.projection.resolution !== 'open') && <Button variant="secondary" size="xs" disabled={ctx.busy} onClick={async () => { const targets = selectedRows.filter(r => r.projection.resolution !== 'open'); const res = await ctx.submitBatchTriage(targets, { disposition: 'restore' }); if (res.succeeded > 0) setSelectedIds(new Set()); }}>Restore selected ({selectedRows.filter(r => r.projection.resolution !== 'open').length})</Button>}
        <Button variant="ghost" size="xs" disabled={ctx.busy} onClick={() => setSelectedIds(new Set())}>Clear</Button>
      </div>}
    </div>}
    {viewMode === 'grouped' && grouped.length > 0 ? <div className="service-groups">
      {grouped.map(group => {
        const isCollapsed = !!collapsedGroups[group.key];
        const groupOpen = group.items.filter(r => r.projection.resolution === 'open').length;
        const groupTriaged = group.items.filter(r => ['deferred', 'screened'].includes(r.projection.resolution)).length;
        const groupEligible = group.items.filter(isTriageCandidate);
        const groupAllSelected = groupEligible.length > 0 && groupEligible.every(r => selectedIds.has(r.id));
        const groupStatusText = groupOpen > 0
          ? `${groupOpen} open${groupTriaged > 0 ? ` · ${groupTriaged} triaged` : ''}`
          : groupTriaged > 0
            ? `${groupTriaged} triaged`
            : 'all judged';
        return <div className="service-group-card" key={group.key}>
          <div className="service-group-header">
            {canBatch && groupEligible.length > 0 && <Checkbox aria-label={`Select all open in ${group.title}`} checked={groupAllSelected} disabled={ctx.busy} onChange={() => toggleSelectGroup(group.items)} />}
            <button type="button" className="service-group-toggle" aria-expanded={!isCollapsed} onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}>
              <ChevronDown size={15} className={`service-group-chevron ${isCollapsed ? 'is-collapsed' : ''}`} />
              <ArtifactKindIcon kind={group.kind} size={15} />
              <strong title={group.title}>{group.title}</strong>
              <span className="service-group-meta">{group.items.length} link{group.items.length === 1 ? '' : 's'} · {groupStatusText}</span>
            </button>
          </div>
          {!isCollapsed && <div className="service-group-rows">{group.items.map(renderRow)}</div>}
        </div>;
      })}
    </div> : <div className="service-list service-relationship-list"><div className="service-list-heading" aria-hidden="true"><span>Relationship</span><span>Validity / Queue</span></div>{rows.map(renderRow)}{!rows.length && <div className="queue-empty"><Search size={24} /><strong>{emptyMessage.title}</strong><p>{emptyMessage.body}</p></div>}</div>}
    {viewMode === 'grouped' && !rows.length && <div className="service-list service-relationship-list"><div className="queue-empty"><Search size={24} /><strong>{emptyMessage.title}</strong><p>{emptyMessage.body}</p></div></div>}
    {batchConfirmOpen && selectedRows.length > 0 && <BatchConfirmDialog ctx={ctx} rows={selectedRows} onClose={() => setBatchConfirmOpen(false)} onCompleted={confirmedIds => setSelectedIds(prev => { const next = new Set(prev); for (const id of confirmedIds) next.delete(id); return next; })} />}
  </section>;
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function historyEventLabel(event) {
  const decision = event.payload?.decision;
  const disposition = event.payload?.disposition;
  if (event.type === 'judgment') {
    if (decision === 'confirm') return 'Confirmed relationship';
    if (decision === 'reject') return 'Rejected suggestion';
    if (decision === 'reconfirm') return 'Reconfirmed after change';
    if (decision === 'retire') return 'Retired relationship';
    return 'Recorded judgment';
  }
  if (event.type === 'triage') {
    if (disposition === 'defer') return 'Deferred in queue';
    if (disposition === 'screen') return 'Screened out suggestion';
    if (disposition === 'restore') return 'Restored to suggestions';
    return 'Queue triage';
  }
  if (event.type === 'reversal') return 'Reversed prior judgment';
  if (event.type === 'follow_up_opened' || event.type === 'follow_up') return 'Opened follow-up task';
  if (event.type === 'follow_up_resolved') return 'Resolved follow-up task';
  return event.type.replaceAll('_', ' ');
}

function Inspector({ ctx }) {
  const [tab, setTab] = useState('review');
  const [evidenceMode, setEvidenceMode] = useState('top');
  const [sourceOpenMap, setSourceOpenMap] = useState({});
  const [sourceJump, setSourceJump] = useState(null);
  const d = ctx.detail;
  const draft = ctx.draft;
  const note = draft.independentNote || '';
  const setNote = independentNote => ctx.updateDraft({ independentNote });
  const mutable = ctx.canWrite && d?.mode === 'active' && !ctx.busy;
  const guarded = d ? { contextId: d.projection.contextId, assertionRevisionId: d.projection.assertionRevisionId, expectedProjectionVersion: d.projection.projectionVersion } : {};
  function command(command, input) { ctx.submit(contextEnvelope(ctx.selection, d, command, { ...guarded, ...input })); }
  const impact = ctx.workspace?.comparison?.impacts?.find(i => i.contextId === d?.projection.contextId);
  const prior = d?.priorDecision || impact?.priorDecision;
  const sourceObjById = useMemo(() => new Map((d?.sources || []).map(s => [s.id, s])), [d]);
  const sourceByVersion = useMemo(() => new Map((d?.sources || []).map(s => [s.id, s.identity?.path || s.identity?.title || s.id])), [d]);
  const artifactById = new Map((ctx.workspace?.artifacts || []).map(a => [a.artifactId, a]));
  const sourceArt = d ? artifactById.get(d.assertion.source.artifactId) : null;
  const targetArt = d ? artifactById.get(d.assertion.target.artifactId) : null;
  const otherOpenCount = ctx.rows.filter(r => r.projection.resolution === 'open' && r.id !== d?.projection.contextId).length;
  const staleOpenCount = ctx.rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open' && r.id !== d?.projection.contextId).length;
  const decisions = d ? permittedDecisions(d.projection) : [];
  const triageDispositions = d ? permittedTriageDispositions(d.projection) : [];
  const activePresetDecision = draft.decision && REASON_PRESETS[draft.decision] ? draft.decision : decisions[0];
  const reasonPresets = activePresetDecision ? (REASON_PRESETS[activePresetDecision] || []) : [];

  const currentVersionIds = useMemo(
    () => (d ? new Set([d.assertion.source.versionId, d.assertion.target.versionId].filter(Boolean)) : new Set()),
    [d]
  );
  const currentSources = useMemo(() => {
    if (!d) return [];
    const filtered = d.sources.filter(s => currentVersionIds.has(s.id));
    return filtered.length ? filtered : d.sources;
  }, [d, currentVersionIds]);

  const changedEndpoints = useMemo(() => {
    if (!d) return [];
    const pairs = [
      { label: 'Source', ref: d.assertion.source, path: sourceArt?.identity?.title || sourceArt?.path || d.assertion.source.artifactId },
      { label: 'Target', ref: d.assertion.target, path: targetArt?.identity?.title || targetArt?.path || d.assertion.target.artifactId },
    ];
    return pairs
      .filter(({ ref }) => ref.priorVersionId && ref.priorVersionId !== ref.versionId)
      .map(({ label, ref, path }) => ({
        label,
        path,
        deleted: !ref.versionId || ref.availability !== 'available',
        beforeText: sourceObjById.get(ref.priorVersionId)?.content || '',
        afterText: ref.versionId ? (sourceObjById.get(ref.versionId)?.content || '') : '',
      }));
  }, [d, sourceArt, targetArt, sourceObjById]);

  const ranked = useMemo(
    () => (d ? rankEvidenceItems(d.evidence, currentSources, sourceArt, targetArt) : { items: [], summary: '', directCount: 0, tokenHistogram: [] }),
    [d, currentSources, sourceArt, targetArt]
  );

  const visibleEvidence = useMemo(() => {
    if (evidenceMode === 'direct') return ranked.items.filter(i => i.isDirect);
    if (evidenceMode === 'all') return ranked.items;
    return ranked.items.slice(0, 4);
  }, [ranked.items, evidenceMode]);

  const priorVersionByCurrentId = useMemo(() => {
    const map = new Map();
    if (!d) return map;
    for (const ep of [d.assertion.source, d.assertion.target]) {
      if (ep?.versionId && ep?.priorVersionId && ep.versionId !== ep.priorVersionId) {
        map.set(ep.versionId, ep.priorVersionId);
      } else if (!ep?.versionId && ep?.priorVersionId) {
        map.set(ep.priorVersionId, ep.priorVersionId);
      }
    }
    return map;
  }, [d]);

  const endpointsAvailable = Boolean(
    d && d.assertion.source?.availability === 'available' && d.assertion.target?.availability === 'available'
  );
  const allEvidenceAvailable = Boolean(d?.evidence?.length) && d.evidence.every(item => item.availability === 'available');
  const canReconfirmDirectly = endpointsAvailable && allEvidenceAvailable;

  const hiddenEvidenceCount = Math.max(0, ranked.items.length - visibleEvidence.length);
  const srcName = sourceArt?.identity?.title || sourceArt?.path || d?.assertion.source.artifactId;
  const tgtName = targetArt?.identity?.title || targetArt?.path || d?.assertion.target.artifactId;
  const meaning = useMemo(
    () => (d ? analyzeRelationshipMeaning(d, sourceArt, targetArt, ranked) : null),
    [d, sourceArt, targetArt, ranked]
  );

  const quickCorrectMeaning = async (nextType, reasonText) => {
    if (!d || !mutable) return;
    await ctx.submit(
      contextEnvelope(ctx.selection, d, 'correct_assertion', {
        contextId: d.projection.contextId,
        assertionRevisionId: d.assertion.id,
        expectedProjectionVersion: d.projection.projectionVersion,
        reason: reasonText,
        replacement: {
          type: nextType,
          sourceArtifactId: d.assertion.source.artifactId,
          sourceVersionId: d.assertion.source.versionId,
          targetArtifactId: d.assertion.target.artifactId,
          targetVersionId: d.assertion.target.versionId,
          evidenceIds: d.assertion.evidenceIds,
        },
      })
    );
  };

  const sourceSideIds = new Set([d?.assertion.source.versionId, d?.assertion.source.priorVersionId].filter(Boolean));
  const targetSideIds = new Set([d?.assertion.target.versionId, d?.assertion.target.priorVersionId].filter(Boolean));
  const sourceEvidence = visibleEvidence.filter(e => sourceSideIds.has(e.artifactVersionId));
  const targetEvidence = visibleEvidence.filter(e => targetSideIds.has(e.artifactVersionId) && !sourceSideIds.has(e.artifactVersionId));
  const splitSideBySide = (sourceEvidence.length > 0 && targetEvidence.length > 0) || (visibleEvidence.length > 0 && currentSources.length >= 2);
  const sourcePreviewObj = d?.assertion.source.versionId ? sourceObjById.get(d.assertion.source.versionId) : null;
  const targetPreviewObj = d?.assertion.target.versionId ? sourceObjById.get(d.assertion.target.versionId) : null;

  const jumpToAnchor = ev => {
    if (!ev?.artifactVersionId) return;
    const start = ev.locator?.kind === 'lines' ? Number(ev.locator.startLine || 1) : 1;
    const end = ev.locator?.kind === 'lines' ? Number(ev.locator.endLine || start) : start;
    setSourceOpenMap(prev => ({ ...prev, [ev.artifactVersionId]: true }));
    setSourceJump({ versionId: ev.artifactVersionId, startLine: start, endLine: end });
  };

  const renderEvidenceCard = e => {
    const enclosing = resolveEvidenceEnclosingLabel(e, sourceObjById, priorVersionByCurrentId);
    const isLineAnchor = e.locator?.kind === 'lines' && e.availability === 'available';
    return <div className="service-evidence-item" key={e.id}>
      <div className="service-evidence-item__head">
        <strong>{sourceByVersion.get(e.artifactVersionId) || 'Captured source'}</strong>
        <Tooltip content="Observed lexical or structural signal for this anchor">
          <span className={`service-signal-pill tier-${e.signalTier}`}>{e.signalLabel}</span>
        </Tooltip>
      </div>
      <div className="service-evidence-item__loc">
        {isLineAnchor ? (
          <button type="button" className="service-anchor-jump" onClick={() => jumpToAnchor(e)} title="Open captured source at these lines">
            {formatLocator(e.locator)}
          </button>
        ) : (
          <span>{formatLocator(e.locator)}{e.availability !== 'available' ? ` · ${e.availability}` : ''}</span>
        )}
        {enclosing && <span className={`service-locator-pill ${enclosing.isUnresolved ? 'is-unresolved' : ''}`}>{enclosing.label}</span>}
      </div>
      {e.excerpt ? <HighlightExcerpt text={e.excerpt} tokens={e.sharedTokens} /> : <pre className="service-excerpt">{e.reason ?? 'No resolvable excerpt.'}</pre>}
    </div>;
  };

  const hasSecondaryDraft = Boolean(draft.contentConcern?.trim()) || (draft.followUpKind && draft.followUpKind !== 'none');
  const targetMeta = ctx.workspace?.revisionMeta?.target;

  return <aside className="inspector service-inspector" aria-label="Relationship inspector"><header className="inspector__header">
    <div className="service-inspector-header-title">
      <h2>Relationship review</h2>
      <div className="service-inspector-rev-row">
        <span className="service-commit-pill">{ctx.selection?.targetRevision?.commitId?.slice(0, 7)}</span>
        <span className="service-inspector-snapshot-state">{d ? `${d.mode} snapshot` : 'Loading context'}</span>
        {targetMeta?.subject && (
          <details className="service-inspector-commit-details">
            <summary className="service-inspector-commit-summary">Commit details</summary>
            <div className="service-inspector-commit-popover">
              <strong>{targetMeta.subject}</strong>
              {(targetMeta.authorName || targetMeta.authoredAt) && (
                <small>
                  {targetMeta.authorName || ''}
                  {targetMeta.authoredAt ? ` · ${formatTimestamp(targetMeta.authoredAt)}` : ''}
                </small>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
    <div className="service-header-actions">{otherOpenCount > 0 && <Tooltip content={staleOpenCount > 0 ? 'Jump to next stale relationship' : 'Jump to next open suggestion'}><Button variant="ghost" size="sm" disabled={ctx.busy} onClick={() => ctx.selectNextOpen(d?.projection.contextId)}>{staleOpenCount > 0 ? 'Next stale' : 'Next suggestion'} <ArrowRight size={14} /></Button></Tooltip>}<Tooltip content="Close inspector"><Button variant="unstyled" className="btn btn--ghost" aria-label="Close inspector" onClick={ctx.closeInspector}><X size={18} /></Button></Tooltip></div>
  </header>
    {!d ? <p className="service-padding" role="status">{ctx.error ? 'Context could not be loaded.' : 'Loading exact evidence…'}</p> : <div className="inspector__body">
      <div className="service-inspector-status">
        <ValidityChip validity={d.projection.validity} />
        <span className="service-inspector-meta-pill"><Clock size={11} aria-hidden="true" />{d.projection.resolution === 'screened' ? 'screened out' : d.projection.resolution} · {d.mode}</span>
      </div>
      <div className="service-endpoints-diagram" aria-label="Connected endpoints">
        <Tooltip content={sourceArt?.path || srcName}>
          <span className="service-endpoint-pill" title={sourceArt?.path}>
            <ArtifactKindIcon kind={sourceArt?.kind} size={13} />
            <span>{srcName}</span>
          </span>
        </Tooltip>
        <Tooltip content={RELATION_HINTS[d.assertion.type] || d.assertion.type}>
          <span className="service-relation-pill">
            <span className="service-rel-tag">{d.assertion.type}</span>
            <ArrowRight size={11} aria-hidden="true" />
          </span>
        </Tooltip>
        <Tooltip content={targetArt?.path || tgtName}>
          <span className="service-endpoint-pill" title={targetArt?.path}>
            <ArtifactKindIcon kind={targetArt?.kind} size={13} />
            <span>{tgtName}</span>
          </span>
        </Tooltip>
      </div>
      {meaning && (
        <section className="service-meaning-card" aria-label="Relationship meaning vs evidence basis">
          <div className="service-meaning-row">
            <span className="service-meaning-row__label">Claimed meaning</span>
            <div className="service-meaning-row__val">
              <strong>{meaning.spec.title}:</strong> {meaning.question}
              <small>{meaning.spec.summary}</small>
            </div>
          </div>
          <div className="service-meaning-row">
            <span className="service-meaning-row__label">Evidence basis</span>
            <div className="service-meaning-row__val">
              <span className={`service-meaning-badge is-${meaning.evidenceBasis.kind}`}>{meaning.evidenceBasis.badge}</span>
              <span>{meaning.evidenceBasis.summary}</span>
            </div>
          </div>
          <div className="service-meaning-row">
            <span className="service-meaning-row__label">Human judgment</span>
            <div className="service-meaning-row__val">
              <span>{meaning.judgmentStatus.summary}</span>
            </div>
          </div>
        </section>
      )}
      {meaning?.mismatchWarning && (
        <section className="service-meaning-warning" role="alert" aria-label="Relationship meaning mismatch">
          <div className="service-meaning-warning__head">
            <AlertTriangle size={15} aria-hidden="true" />
            <strong>{meaning.mismatchWarning.headline}</strong>
          </div>
          <p>{meaning.mismatchWarning.explanation}</p>
          {mutable && endpointsAvailable && (
            <div className="service-meaning-warning__actions">
              <Button
                variant="default"
                size="xs"
                disabled={ctx.busy}
                onClick={() => quickCorrectMeaning(meaning.mismatchWarning.suggestedType, meaning.mismatchWarning.defaultReason)}
              >
                Correct meaning to {meaning.mismatchWarning.suggestedType}
              </Button>
            </div>
          )}
        </section>
      )}
      {d.returnContextId ? <Button variant="secondary" size="sm" onClick={() => ctx.selectArtifact(d.returnContextId)}>Return to incoming review</Button> : impact && <section className="card card--p-sm service-prior-card" aria-label="Retained baseline decision">
        <div className="service-prior-card__head"><strong>Why flagged &amp; prior decision</strong>{prior && <span className={`service-chip service-chip--${prior.validity}`}>{prior.decision || prior.validity}</span>}</div>
        <p className="service-prior-card__flag">{impact.reason || 'An endpoint changed in the target revision.'}</p>
        {prior ? <>
          <p className="service-prior-card__meta">{prior.decision ? `${prior.actorDisplayName || prior.actorId || 'Reviewer'} · ${formatTimestamp(prior.recordedAt)}` : `Baseline state: ${prior.validity} (${prior.resolution})`}</p>
          <p className="service-prior-card__reason">{prior.decision ? reasonLabel(prior.reason) : 'No manual decision was recorded on the baseline context.'}</p>
        </> : <p className="service-prior-card__meta">Compare baseline context directly to inspect retained rationale and source anchors.</p>}
        <Button variant="secondary" size="sm" onClick={ctx.openPriorDecision}>Inspect prior decision &amp; evidence</Button>
      </section>}
      <Tabs value={tab} onValueChange={setTab} className="service-tabs"><TabsList className="service-tabs-list service-tabs-list--two" aria-label="Relationship context views">{['review', 'history'].map(t => <TabsTrigger className="service-tabs-trigger" value={t} key={t}>{t}</TabsTrigger>)}</TabsList>
      <TabsContent className="service-tab-panel" value="review">
        <form className="journey-form service-judgment-form service-judgment-form--top" onSubmit={e => { e.preventDefault(); ctx.saveJudgment(); }}>
          {decisions.length > 0 && <div className="service-decision-field">
            <div className="service-decision-label-row">
              <span className="service-decision-label">Relationship judgment</span>
              <Tooltip content={decisions.includes('reconfirm') ? 'Reconfirm = still valid after changes · Retire = no longer applies' : decisions.includes('confirm') ? 'Confirm = evidence supports claimed meaning · Reject = unrelated or wrong meaning' : 'Retire = relationship no longer applies'}>
                <span className="service-info-dot" aria-label="Decision meanings"><Info size={13} aria-hidden="true" /></span>
              </Tooltip>
            </div>
            {decisions.includes('reconfirm') && !canReconfirmDirectly && (
              <p className="service-reconfirm-hint" role="note">
                The earlier evidence could not be matched to this revision. Choose <strong>Correct this relationship</strong> to select new evidence, or <strong>Retire</strong> if the link no longer applies.
              </p>
            )}
            <div className="service-decision-toggle" role="radiogroup" aria-label="Relationship judgment">
              {decisions.map(v => {
                const blockedReconfirm = v === 'reconfirm' && !canReconfirmDirectly;
                const hint = blockedReconfirm
                  ? 'Select new evidence under Correct this relationship before reconfirming.'
                  : (DECISION_HINTS[v] || v);
                return <Tooltip key={v} content={hint}>
                  <button type="button" role="radio" aria-checked={draft.decision === v} disabled={!mutable || blockedReconfirm} className={`service-decision-btn ${draft.decision === v ? 'is-selected' : ''}`} onClick={() => ctx.updateDraft({ decision: v })}><DecisionIcon decision={v} />{v}</button>
                </Tooltip>;
              })}
            </div>
          </div>}
          {(['confirm', 'reconfirm'].includes(draft.decision) || !draft.decision) && decisions.some(v => ['confirm', 'reconfirm'].includes(v)) && (
            <label className="service-checkbox"><Checkbox checked={draft.inspected} disabled={!mutable} onChange={e => ctx.updateDraft({ inspected: e.target.checked })} />I inspected the exact sources and recorded evidence.</label>
          )}
          <label>{optionalReason(d, draft.decision) ? 'Reason (optional)' : 'Reason'}<Textarea rows={2} value={draft.reason} disabled={!mutable} required={!optionalReason(d, draft.decision)} maxLength={4000} placeholder={optionalReason(d, draft.decision) ? 'Optional rationale for future reviewers…' : 'Explain why this judgment applies…'} onChange={e => ctx.updateDraft({ reason: e.target.value })} /></label>
          {decisions.length > 0 && draft.decision && reasonPresets.length > 0 && (
            <div className="service-preset-row" aria-label="Optional rationale presets">
              <span className="service-preset-label">Quick notes ({activePresetDecision}):</span>
              {reasonPresets.map(preset => (
                <button
                  type="button"
                  key={preset}
                  disabled={!mutable}
                  className={`service-preset-chip ${draft.reason === preset ? 'is-active' : ''}`}
                  onClick={() => ctx.updateDraft({ decision: draft.decision || activePresetDecision, reason: preset })}
                >{preset}</button>
              ))}
            </div>
          )}
          <div className="service-toolbar"><Button variant="unstyled" type="submit" className="btn btn--accent" disabled={!mutable || !decisions.length}>Save judgment</Button>{otherOpenCount > 0 && <Button variant="secondary" type="button" disabled={!mutable || !decisions.length} onClick={() => ctx.saveJudgment(true)}>Save &amp; next</Button>}</div>
          {triageDispositions.length > 0 && (
            <div className="service-triage-inline" aria-label="Lightweight candidate triage">
              <span>
                {d.projection.resolution === 'open' && 'Not ready to judge?'}
                {d.projection.resolution === 'deferred' && 'Deferred (unconfirmed):'}
                {d.projection.resolution === 'screened' && 'Screened out (unconfirmed):'}
              </span>
              <div className="service-triage-bar__actions">
                {triageDispositions.map(disp => (
                  <Button
                    key={disp}
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!mutable}
                    onClick={() => ctx.triageCandidate(d, disp, null, disp !== 'restore')}
                  >{TRIAGE_LABELS[disp] || disp}</Button>
                ))}
              </div>
            </div>
          )}
          <small className="service-draft-hint">Drafts stay in this browser under your account and exact context.</small>
        </form>
        {['candidate', 'stale', 'confirmed'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} correction defaultOpen={Boolean(meaning?.mismatchWarning)} />}
        {['rejected', 'retired'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} successor />}
        {changedEndpoints.length > 0 && <Disclosure trigger="What changed since last review" badge={`${changedEndpoints.length} changed`} defaultOpen variant="card" className="service-diff-disclosure">
          {changedEndpoints.map(ep => <EndpointDiffBox key={ep.path} {...ep} />)}
        </Disclosure>}
        <div className="service-evidence-header">
          <div className="service-evidence-title">
            <h3>Recorded evidence</h3>
            <Tooltip content={ranked.summary || 'Exact line and path anchors retained for this relationship'}>
              <span className="service-info-dot" aria-label={ranked.summary}><Info size={13} aria-hidden="true" /></span>
            </Tooltip>
          </div>
          <span className="service-breakdown-pill"><Link2 size={11} aria-hidden="true" />{d.evidence.length} anchor{d.evidence.length === 1 ? '' : 's'}</span>
        </div>
        {ranked.items.length > 4 && <div className="service-evidence-filters" role="group" aria-label="Evidence signal filter">
          <Tooltip content="Highest-ranked direct mentions and shared identifiers">
            <button type="button" className={evidenceMode === 'top' ? 'is-active' : ''} onClick={() => setEvidenceMode('top')}>Top signals (4)</button>
          </Tooltip>
          {ranked.directCount > 0 && <Tooltip content="Explicit repository-relative file or stem matches">
            <button type="button" className={evidenceMode === 'direct' ? 'is-active' : ''} onClick={() => setEvidenceMode('direct')}>Direct mentions ({ranked.directCount})</button>
          </Tooltip>}
          <Tooltip content="Show every retained evidence anchor">
            <button type="button" className={evidenceMode === 'all' ? 'is-active' : ''} onClick={() => setEvidenceMode('all')}>All ({ranked.items.length})</button>
          </Tooltip>
        </div>}
        {splitSideBySide ? (
          <div className="service-evidence-split">
            <div className="service-evidence-col">
              <div className="service-evidence-col__head"><span>Source</span><strong title={srcName}>{srcName?.split('/').at(-1)}</strong></div>
              <div className="service-evidence-list">
                {sourceEvidence.length > 0 ? sourceEvidence.map(renderEvidenceCard) : (
                  <div className="service-evidence-item service-evidence-item--preview">
                    <div className="service-evidence-item__head"><strong>{srcName}</strong><span className="service-kind-badge">{ARTIFACT_KIND_LABELS[sourceArt?.kind] || 'Source'}</span></div>
                    <pre className="service-excerpt">{sourcePreviewObj?.content?.split('\n').slice(0, 6).join('\n') || 'Open captured source below to inspect full text.'}</pre>
                  </div>
                )}
              </div>
            </div>
            <div className="service-evidence-col">
              <div className="service-evidence-col__head"><span>Target</span><strong title={tgtName}>{tgtName?.split('/').at(-1)}</strong></div>
              <div className="service-evidence-list">
                {targetEvidence.length > 0 ? targetEvidence.map(renderEvidenceCard) : (
                  <div className="service-evidence-item service-evidence-item--preview">
                    <div className="service-evidence-item__head"><strong>{tgtName}</strong><span className="service-kind-badge">{ARTIFACT_KIND_LABELS[targetArt?.kind] || 'Target'}</span></div>
                    <pre className="service-excerpt">{targetPreviewObj?.content?.split('\n').slice(0, 6).join('\n') || 'Open captured source below to inspect full text.'}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="service-evidence-list">
            {visibleEvidence.map(renderEvidenceCard)}
          </div>
        )}
        {evidenceMode === 'top' && hiddenEvidenceCount > 0 && <div className="service-evidence-more">
          <Button variant="ghost" size="xs" onClick={() => setEvidenceMode('all')}>Show {hiddenEvidenceCount} more anchor{hiddenEvidenceCount === 1 ? '' : 's'} ({ranked.items.length} total)</Button>
        </div>}
        {evidenceMode !== 'top' && ranked.items.length > 4 && <div className="service-evidence-more">
          <Button variant="ghost" size="xs" onClick={() => setEvidenceMode('top')}>Show top 4 signals</Button>
        </div>}
        <div className="service-sources-stack">
          {currentSources.map(s => (
            <Source
              key={s.id}
              source={s}
              defaultOpen={false}
              open={sourceOpenMap[s.id] ?? false}
              onOpenChange={isOpen => setSourceOpenMap(prev => ({ ...prev, [s.id]: isOpen }))}
              selectedRange={sourceJump?.versionId === s.id ? [sourceJump.startLine, sourceJump.endLine] : null}
              jumpLine={sourceJump?.versionId === s.id ? sourceJump.startLine : null}
              tone="quiet"
            />
          ))}
        </div>
        <div className="service-secondary-tools">
          <span className="service-secondary-label">Secondary tools</span>
          <Disclosure trigger="Content concerns & follow-up" badge={hasSecondaryDraft ? 'Draft' : null} defaultOpen={hasSecondaryDraft} variant="card" className="service-disclosure-box">
            <label>Content concern (independent of relationship validity)<Textarea rows={2} value={draft.contentConcern} disabled={!mutable} maxLength={4000} onChange={e => ctx.updateDraft({ contentConcern: e.target.value })} /></label>
            <label>Follow-up work<Select value={draft.followUpKind} disabled={!mutable} onChange={e => ctx.updateDraft({ followUpKind: e.target.value })}><option value="none">None</option><option value="documentation_update">Documentation update</option><option value="code_update">Code update</option></Select></label>
            {draft.followUpKind !== 'none' && <label>Work description<Textarea rows={2} value={draft.followUpNote} disabled={!mutable} required onChange={e => ctx.updateDraft({ followUpNote: e.target.value })} /></label>}
          </Disclosure>
        </div>
        <Disclosure trigger="Follow-up & judgment actions" badge={d.followUps.length > 0 ? d.followUps.length : null} defaultOpen={d.followUps.length > 0} variant="card" className="service-disclosure-box">
          <h3>Independent follow-up</h3>
          <label className="journey-form">Verification or work note<Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="service-toolbar"><Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('open_follow_up', { workKind: 'documentation_update', note, relatedJudgmentEventId: null })}>Open documentation follow-up</Button>
          {d.projection.effectiveJudgmentEventId && <Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('reverse_judgment', { eventId: d.projection.effectiveJudgmentEventId, reason: note })}>Append reversal of effective judgment</Button>}</div>
          {d.followUps.map(w => <div className="card card--p-sm service-followup-item" key={w.id}><div className="service-followup-item__head"><strong>{w.kind.replaceAll('_', ' ')}</strong><span className="service-breakdown-pill">{w.status}</span></div><small className="service-id">{w.id}</small>{w.status === 'open' && <Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('resolve_follow_up', { followUpId: w.id, verificationNote: note })}>Resolve with verification note</Button>}</div>)}
        </Disclosure>
        {!mutable && <p className="inline-notice">This view is read-only. Current reviewer access and a fresh snapshot are required to write.</p>}
        <Disclosure trigger={`Technical details & limitations (${d.assertion.limitations.length})`} variant="subtle">
          <div className="service-technical-details">
            <p className="service-id">Context {d.projection.contextId} · Revision {d.assertion.id} · Projection v{d.projection.projectionVersion}</p>
            {d.assertion.limitations.length > 0 && <ul className="service-technical-list">{d.assertion.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
            <Disclosure trigger={`Locator records (${d.evidence.length})`} variant="subtle">
              <pre className="service-json">{JSON.stringify(d.evidence.map(e => ({ id: e.id, locator: e.locator })), null, 2)}</pre>
            </Disclosure>
            <Disclosure trigger="Processing provenance" variant="subtle">
              <pre className="service-json">{JSON.stringify(d.provenance, null, 2)}</pre>
            </Disclosure>
          </div>
        </Disclosure>
      </TabsContent>
      <TabsContent className="service-tab-panel" value="history">
        <p className="service-method">Append-only audit trail retained up to this snapshot’s sequence boundary.</p>
        {d.history.items.map(e => {
          const evCount = e.payload?.reviewedEvidenceIds?.length || 0;
          const concern = e.payload?.contentConcern;
          const followUp = e.payload?.followUpDisposition?.kind && e.payload.followUpDisposition.kind !== 'none' ? e.payload.followUpDisposition : null;
          return <div className="card card--p-sm service-history-card" key={e.id}>
            <div className="service-history-card__head">
              <strong>{historyEventLabel(e)}</strong>
              <div className="service-history-card__badges">
                {(e.payload?.decision || e.payload?.disposition) && <span className="service-decision-pill">{e.payload.decision || e.payload.disposition}</span>}
                <span className="service-seq-badge">seq {e.sequence}</span>
              </div>
            </div>
            <p className="service-history-reason">{e.type === 'triage' && !e.reason ? 'Queue triage disposition recorded (no note).' : reasonLabel(e.reason)}</p>
            <div className="service-history-facts">
              <span title={e.recordedAt}>{formatTimestamp(e.recordedAt)}</span>
              <span>Reviewer: <strong>{e.actorId}</strong></span>
              {evCount > 0 && <span>{evCount} evidence anchor{evCount === 1 ? '' : 's'} verified</span>}
              {concern && <span>Content concern: {concern}</span>}
              {followUp && <span>Follow-up: {followUp.workKind?.replaceAll('_', ' ')}</span>}
            </div>
            <Disclosure trigger="Raw event JSON" variant="subtle"><pre className="service-json">{JSON.stringify(e, null, 2)}</pre></Disclosure>
          </div>;
        })}
        {!d.history.items.length && <p className="service-empty-note">No review events at this snapshot.</p>}
        {d.history.nextCursor && <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={ctx.loadMoreHistory}>Load earlier history entries</Button>}
      </TabsContent>
    </Tabs></div>}
  </aside>;
}

function Files({ ctx }) {
  const activeArtifact = ctx.workspace.artifacts.find(a => a.artifactId === ctx.state.sourceArtifactId) || ctx.workspace.artifacts[0] || null;
  const [loadedByVersion, setLoadedByVersion] = useState({});
  const [blameByVersion, setBlameByVersion] = useState({});
  const [commitInspect, setCommitInspect] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const bodyRef = useRef(null);
  const readerRef = useRef(null);
  const activeVersionId = activeArtifact?.versionId || null;
  const selectedData = activeVersionId ? loadedByVersion[activeVersionId] : null;
  const activeBlame = activeVersionId ? blameByVersion[activeVersionId] : null;
  const lineBlameMap = useMemo(() => buildLineBlameLookup(activeBlame), [activeBlame]);

  useEffect(() => {
    if (!activeVersionId) return;
    const abort = new AbortController();
    ctx.api.version(ctx.selection.repositoryId, activeVersionId, abort.signal)
      .then(data => setLoadedByVersion(prev => (prev[data.id] ? prev : { ...prev, [data.id]: data })))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    ctx.api.blame(ctx.selection.repositoryId, activeVersionId, abort.signal)
      .then(bdata => setBlameByVersion(prev => ({ ...prev, [activeVersionId]: bdata })))
      .catch(() => { /* Blame optional */ });
    return () => abort.abort();
  }, [activeVersionId, ctx.selection.repositoryId, ctx.api]);

  const topDirectories = useMemo(() => {
    const counts = new Map();
    for (const a of ctx.workspace.artifacts) {
      const parts = (a.path || '').split('/');
      const dir = parts.length > 2 ? `${parts[0]}/${parts[1]}` : (parts.length > 1 ? parts[0] : '(root)');
      counts.set(dir, (counts.get(dir) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [ctx.workspace.artifacts]);

  const filteredArtifacts = useMemo(() => ctx.workspace.artifacts.filter(a => {
    const matchesSearch = `${a.path} ${a.identity?.title || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesKind = kindFilter === 'all' || a.kind === kindFilter;
    if (!matchesSearch || !matchesKind) return false;
    if (dirFilter === 'all') return true;
    if (dirFilter === '(root)') return !(a.path || '').includes('/');
    return (a.path || '').startsWith(`${dirFilter}/`) || a.path === dirFilter;
  }), [ctx.workspace.artifacts, search, kindFilter, dirFilter]);

  const visibleArtifacts = useMemo(
    () => filteredArtifacts.slice(0, visibleLimit),
    [filteredArtifacts, visibleLimit]
  );

  const selectedLinesCommits = useMemo(() => {
    if (!lineBlameMap) return [];
    const seen = new Set();
    const list = [];
    for (let ln = rangeStart; ln <= rangeEnd; ln += 1) {
      const info = lineBlameMap.get(ln);
      if (info?.commit && !seen.has(info.commit.commitId)) {
        seen.add(info.commit.commitId);
        list.push(info.commit);
      }
    }
    return list;
  }, [lineBlameMap, rangeStart, rangeEnd]);

  const connected = activeArtifact ? ctx.rows.filter(r => r.assertion.source.artifactId === activeArtifact.artifactId || r.assertion.target.artifactId === activeArtifact.artifactId) : [];
  const structureItems = selectedData?.structure?.items || [];
  const canAnchor = ctx.canWrite && ctx.workspace.mode === 'active' && selectedData;
  const scrollToLine = lineNo => {
    const row = bodyRef.current?.querySelector(`[data-line="${lineNo}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  };
  const handleSelectLine = (lineNo, event) => {
    if (event?.shiftKey) {
      setRangeStart(prev => Math.min(prev, lineNo));
      setRangeEnd(Math.max(rangeStart, lineNo));
    } else {
      setRangeStart(lineNo);
      setRangeEnd(lineNo);
    }
  };
  const lastMod = activeBlame?.lastModified;

  return <section className="service-files">
    <div className="service-filters">
      <label className="service-search-field">Find a file<Input type="search" placeholder="Search paths and record titles" value={search} onChange={e => { setSearch(e.target.value); setVisibleLimit(150); }} /></label>
      <label className="service-validity-field">Artifact kind<Select aria-label="Filter by artifact kind" value={kindFilter} onChange={e => { setKindFilter(e.target.value); setVisibleLimit(150); }}>{['all', 'code', 'document', 'requirement', 'decision'].map(k => <option key={k} value={k}>{k === 'all' ? 'All kinds' : ARTIFACT_KIND_LABELS[k]}</option>)}</Select></label>
      {topDirectories.length > 1 && (
        <label className="service-validity-field">Folder / package<Select aria-label="Filter by folder" value={dirFilter} onChange={e => { setDirFilter(e.target.value); setVisibleLimit(150); }}>
          <option value="all">All folders ({ctx.workspace.artifacts.length})</option>
          {topDirectories.map(([dir, cnt]) => <option key={dir} value={dir}>{dir} ({cnt})</option>)}
        </Select></label>
      )}
      <span className="service-result-count">{filteredArtifacts.length} of {ctx.workspace.artifacts.length} artifacts</span>
    </div>
    <div className="service-file-grid">
      <div className="service-file-list">
        <div className="service-list-heading"><span>Repository files</span><span>{filteredArtifacts.length}</span></div>
        {visibleArtifacts.map(a => {
          const sym = a.structureSummary?.symbolCount || 0;
          const sec = a.structureSummary?.sectionCount || 0;
          const structText = sym > 0 ? `${sym} sym` : sec > 0 ? `${sec} sec` : null;
          const fmt = a.identity?.format;
          const selected = activeArtifact?.versionId === a.versionId;
          return <Button variant="unstyled" className={`service-row service-file-row ${selected ? 'is-selected' : ''}`} aria-current={selected ? 'true' : undefined} key={a.versionId} onClick={() => {
            setError(''); setRangeStart(1); setRangeEnd(1);
            ctx.setState(s => ({ ...s, sourceArtifactId: a.artifactId }));
            if (window.matchMedia('(max-width: 900px)').matches) {
              readerRef.current?.focus();
              readerRef.current?.scrollIntoView({ block: 'start' });
            }
          }}>
            <ArtifactKindIcon kind={a.kind} size={15} />
            <span><strong>{a.identity.title || a.path.split('/').at(-1)}</strong><small title={a.path}>{a.path}{structText ? ` · ${structText}` : ''}</small></span>
            <span className="service-kind-badge">{fmt || a.kind}</span>
          </Button>;
        })}
        {filteredArtifacts.length > visibleLimit && (
          <div className="service-padding">
            <Button variant="secondary" size="sm" onClick={() => setVisibleLimit(v => v + 250)}>
              Show more files ({filteredArtifacts.length - visibleLimit} remaining)
            </Button>
          </div>
        )}
        {!filteredArtifacts.length && <p className="service-padding service-empty-note">No artifacts match this filter.</p>}
      </div>
      <section className="service-file-reader" ref={readerRef} tabIndex={-1} aria-label="Selected file">
        {error && <p className="inline-notice form-error" role="alert">{error}</p>}
        {selectedData ? <>
          <header className="service-file-header-card">
            <div>
              <div className="service-file-header-card__title">
                <span className="service-kind-badge">{selectedData.identity?.format || ARTIFACT_KIND_LABELS[activeArtifact.kind] || activeArtifact.kind}</span>
                <strong>{selectedData.identity.title || activeArtifact.path.split('/').at(-1)}</strong>
              </div>
              <small className="service-id">{activeArtifact.path} · SHA-256 {(typeof selectedData.contentDigest === 'string' ? selectedData.contentDigest : selectedData.contentDigest?.value || '').slice(0, 12)}{selectedData.structure?.engine ? ` · ${selectedData.structure.engine}` : ''}</small>
            </div>
            <div className="service-file-header-actions">
              <span className="service-breakdown-pill">{connected.length} connected {connected.length === 1 ? 'link' : 'links'}</span>
              {selectedData.identity.kind === 'record' && <RecordRevision ctx={ctx} record={selectedData} />}
            </div>
          </header>

          {activeBlame?.available && lastMod && (
            <section className="service-gitlens-panel" aria-label="GitLens authorship and blame">
              <div className="service-gitlens-panel__latest">
                <div className="service-gitlens-panel__latest-main">
                  <GitCommit size={15} aria-hidden="true" />
                  <div>
                    <div className="service-gitlens-panel__headline">
                      <strong>{lastMod.authorName}</strong>
                      {lastMod.authorEmail && <small>&lt;{lastMod.authorEmail}&gt;</small>}
                      <span>modified this file in</span>
                      <code className="service-commit-pill">{lastMod.shortCommitId || (lastMod.commitId || '').slice(0, 7)}</code>
                      {lastMod.authoredAt && <small>· {formatTimestamp(lastMod.authoredAt)}</small>}
                    </div>
                    <p className="service-gitlens-panel__commit-msg">
                      “{lastMod.subject || lastMod.summary || lastMod.message}”
                    </p>
                  </div>
                </div>
                {lastMod.commitId && (
                  <Button variant="secondary" size="xs" onClick={() => setCommitInspect({ commitId: lastMod.commitId, path: activeArtifact.path })}>
                    <GitCompare size={12} /> Inspect commit diff
                  </Button>
                )}
              </div>

              {activeBlame.contributors?.length > 0 && (
                <div className="service-gitlens-contributors" aria-label="File contributors">
                  <span className="service-gitlens-contributors__label">Past modifiers ({activeBlame.contributors.length}):</span>
                  {activeBlame.contributors.map(c => (
                    <Tooltip
                      key={`${c.authorName}-${c.authorEmail}`}
                      content={`${c.authorName}${c.authorEmail ? ` <${c.authorEmail}>` : ''} · ${c.lineCount} lines (${c.percentage}%) across ${c.commitCount} commit(s) · Latest: ${c.latestShortCommitId} "${c.latestSummary}"`}
                    >
                      <button
                        type="button"
                        className="service-contributor-chip"
                        onClick={() => c.latestCommitId && setCommitInspect({ commitId: c.latestCommitId, path: activeArtifact.path })}
                      >
                        <span className="service-contributor-avatar">{(c.authorName || 'U').slice(0, 2).toUpperCase()}</span>
                        <strong>{c.authorName}</strong>
                        <small>{c.percentage}% ({c.lineCount}L · {c.commitCount}c)</small>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </section>
          )}

          {structureItems.length > 0 && (
            <section className="service-structure-panel" aria-label="Extracted structure outline">
              <div className="service-structure-panel__head">
                <strong>{selectedData.structure?.engine === 'tree-sitter-python' ? 'Python AST outline' : 'Markdown outline'} ({structureItems.length})</strong>
                <small>Click any symbol or section to highlight lines</small>
              </div>
              <div className="service-structure-chips">
                {structureItems.map(item => {
                  const Icon = item.kind === 'section' ? Hash : Code2;
                  const active = rangeStart === item.startLine && rangeEnd === item.endLine;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`service-structure-chip ${active ? 'is-active' : ''}`}
                      title={item.signature}
                      onClick={() => { setRangeStart(item.startLine); setRangeEnd(item.endLine); scrollToLine(item.startLine); }}
                    >
                      <Icon size={11} aria-hidden="true" />
                      <span>{item.qualifiedName || item.name}</span>
                      <small>{item.startLine}–{item.endLine}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          <div className="service-anchor-bar">
            <div className="service-anchor-bar__left">
              <span>{rangeStart === rangeEnd ? `Line ${rangeStart}` : `Lines ${rangeStart}–${rangeEnd}`} selected <small>(click or Shift-click lines below)</small></span>
              {selectedLinesCommits.length > 0 && (
                <div className="service-gitlens-line-blame" aria-label="Selected line GitLens blame">
                  {selectedLinesCommits.slice(0, 2).map(c => (
                    <span className="service-gitlens-line-blame__item" key={c.commitId}>
                      <GitCommit size={12} aria-hidden="true" />
                      <strong>{c.authorName}</strong>
                      <code className="service-commit-pill">{c.shortCommitId}</code>
                      <span className="service-gitlens-line-blame__summary" title={c.summary}>“{c.summary}”</span>
                      <small>{(c.authoredAt || '').slice(0, 10)}</small>
                      <button
                        type="button"
                        className="text-link service-gitlens-diff-btn"
                        onClick={() => setCommitInspect({ commitId: c.commitId, path: activeArtifact.path })}
                      >
                        View diff
                      </button>
                    </span>
                  ))}
                  {selectedLinesCommits.length > 2 && <small>+{selectedLinesCommits.length - 2} more commits in range</small>}
                </div>
              )}
            </div>
            {canAnchor && (
              <div className="service-anchor-bar__actions">
                <Button variant="secondary" size="xs" onClick={() => ctx.openRecordWithSeed({ artifact: activeArtifact, startLine: rangeStart, endLine: rangeEnd })}>Record requirement or decision for lines</Button>
                <Button variant="secondary" size="xs" onClick={() => ctx.openNewRelationshipWithSeed({ artifact: activeArtifact, startLine: rangeStart, endLine: rangeEnd })}>Add relationship from lines</Button>
              </div>
            )}
          </div>
          <Source
            source={selectedData}
            selectedRange={[rangeStart, rangeEnd]}
            onSelectLine={handleSelectLine}
            bodyRef={bodyRef}
            blame={activeBlame}
            defaultShowBlame={true}
            onInspectCommit={req => setCommitInspect(req)}
          />
          {activeBlame?.fileHistory?.length > 0 && (
            <Disclosure trigger={`GitLens File Commit History (${activeBlame.fileHistory.length} commits touching ${activeArtifact.path.split('/').at(-1)})`} defaultOpen variant="card" className="service-gitlens-history">
              <div className="service-gitlens-history__list">
                {activeBlame.fileHistory.map(commit => (
                  <div className="service-gitlens-history__row" key={commit.commitId}>
                    <code className="service-commit-pill">{commit.shortCommitId}</code>
                    <div className="service-gitlens-history__body">
                      <strong>{commit.subject}</strong>
                      <small>{commit.authorName}{commit.authorEmail ? ` <${commit.authorEmail}>` : ''} · {formatTimestamp(commit.authoredAt)}</small>
                    </div>
                    <Button variant="secondary" size="xs" onClick={() => setCommitInspect({ commitId: commit.commitId, path: activeArtifact.path })}>
                      <GitCompare size={12} /> Inspect diff
                    </Button>
                  </div>
                ))}
              </div>
            </Disclosure>
          )}
          {connected.length > 0 && <section className="service-file-relations" aria-label="Connected relationships for this artifact">
            <h3>Connected relationships ({connected.length})</h3>
            <div className="service-file-relations__list">
              {connected.map(r => <button type="button" key={r.id} className="service-file-relation-btn" onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(r.id); }}>
                <span><strong>{r.sourceLabel || r.sourcePath}</strong><small>{r.assertion.type} → {r.targetLabel || r.targetPath}</small></span>
                <span className="service-breakdown-pill">{r.projection.validity}</span>
                <ChevronRight size={14} />
              </button>)}
            </div>
          </section>}
        </> : !error && <div className="service-reader-empty" role={activeArtifact ? 'status' : undefined}><FileCode2 size={28} /><h2>{activeArtifact ? 'Loading captured source…' : 'No captured files yet'}</h2>{!activeArtifact && <p>Capture this revision to browse its files here.</p>}</div>}
      </section>
    </div>
    {commitInspect && <CommitDiffDialog key={`${commitInspect.commitId}:${commitInspect.path || ''}`} ctx={ctx} commitRequest={commitInspect} onClose={() => setCommitInspect(null)} />}
  </section>;
}

function RecordDialog({ ctx }) {
  const seed = ctx.modalSeed;
  const key = JSON.stringify(['record', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId]);
  const stored = ctx.formDrafts[key];
  const fileArtifacts = (ctx.workspace?.artifacts || []).filter(a => a.kind === 'code' || a.kind === 'document');
  const codeArtifacts = (ctx.workspace?.artifacts || []).filter(a => a.kind === 'code');
  const defaultArtifact = seed?.artifact || fileArtifacts[0] || ctx.workspace?.artifacts?.[0] || null;
  const defaultCode = (seed?.artifact?.kind === 'code' ? seed.artifact : codeArtifacts[0]) || null;

  const baseForm = stored || {
    title: '',
    content: '',
    kind: 'decision',
    sourceMode: 'none',
    reason: '',
    anchorArtifactId: defaultArtifact?.artifactId || '',
    anchorStart: '',
    anchorEnd: '',
    externalLabel: '',
    externalUri: '',
    alsoLink: false,
    linkTargetId: defaultCode?.artifactId || '',
    linkStart: '',
    linkEnd: '',
    linkReason: '',
  };
  const [seededOverride, setSeededOverride] = useState(() => (seed?.artifact ? {
    sourceMode: 'artifact',
    anchorArtifactId: seed.artifact.artifactId,
    anchorStart: seed.startLine || 1,
    anchorEnd: seed.endLine || seed.startLine || 1,
    ...(seed.artifact.kind === 'code' ? { alsoLink: true, linkTargetId: seed.artifact.artifactId, linkStart: seed.startLine || 1, linkEnd: seed.endLine || seed.startLine || 1 } : {}),
  } : null));

  const form = seededOverride ? { ...baseForm, ...seededOverride } : baseForm;
  const update = patch => {
    const next = { ...form, ...patch };
    setSeededOverride(null);
    ctx.saveFormDraft(key, next);
  };

  const anchoredArtifact = ctx.workspace?.artifacts?.find(a => a.artifactId === form.anchorArtifactId) || defaultArtifact;
  const linkTarget = codeArtifacts.find(a => a.artifactId === form.linkTargetId) || defaultCode;
  const { title, content, kind, reason, sourceMode } = form;
  const hasAnchorRange = sourceMode !== 'artifact' || (Number.isInteger(Number(form.anchorStart)) && Number(form.anchorStart) >= 1 && Number(form.anchorEnd) >= Number(form.anchorStart));
  const hasLinkRange = !form.alsoLink || (Number.isInteger(Number(form.linkStart)) && Number(form.linkStart) >= 1 && Number(form.linkEnd) >= Number(form.linkStart));
  const canSubmit = ctx.canWrite && !ctx.busy && hasAnchorRange && hasLinkRange;

  return <Dialog open onOpenChange={open => !open && ctx.closeModal()}>
    <DialogContent className="service-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="record-title" aria-describedby="record-desc">
      <div className="service-dialog-head">
        <div>
          <DialogTitle id="record-title">Record requirement or decision</DialogTitle>
          <DialogDescription id="record-desc">Capture an authored decision or requirement in this snapshot. Linked claims enter separately as unconfirmed candidates.</DialogDescription>
        </div>
        <Button variant="unstyled" className="btn service-dialog-close" onClick={ctx.closeModal} aria-label="Close record form"><X size={18} /></Button>
      </div>
      <form className="service-dialog-form" onSubmit={async e => {
        e.preventDefault();
        if (!canSubmit) return;
        let sourceReference = null;
        let sourceAbsenceReason = null;
        if (sourceMode === 'artifact' && anchoredArtifact) {
          sourceReference = {
            kind: 'artifact',
            artifactVersionId: anchoredArtifact.versionId,
            locator: { kind: 'lines', startLine: Number(form.anchorStart), endLine: Number(form.anchorEnd || form.anchorStart) },
          };
        } else if (sourceMode === 'external') {
          sourceReference = {
            kind: 'external',
            uri: form.externalUri.trim(),
            label: form.externalLabel.trim(),
            availability: 'available',
            reason: null,
          };
        } else {
          sourceAbsenceReason = reason;
        }
        const recordInput = { kind, title, content, sourceReference, sourceAbsenceReason };
        const linkSpec = form.alsoLink && linkTarget
          ? {
              target: linkTarget,
              startLine: Number(form.linkStart),
              endLine: Number(form.linkEnd || form.linkStart),
              reason: form.linkReason.trim() || `Authored ${kind}: ${title}`,
              evidenceOn: 'target',
            }
          : null;
        const saved = await ctx.submitRecordIntent({ recordInput, linkSpec, draftKey: key });
        if (saved) {
          setSeededOverride(null);
          ctx.saveFormDraft(key, {
            title: '', content: '', kind: 'decision', sourceMode: 'none', reason: '',
            anchorArtifactId: defaultArtifact?.artifactId || '', anchorStart: '', anchorEnd: '',
            externalLabel: '', externalUri: '', alsoLink: false, linkTargetId: defaultCode?.artifactId || '',
            linkStart: '', linkEnd: '', linkReason: '',
          });
          ctx.closeModal();
        }
      }}>
        <div className="service-dialog-body journey-form">
          <div className="service-form-grid-2">
            <label>Kind<Select value={kind} onChange={e => update({ kind: e.target.value })}><option value="decision">Decision</option><option value="requirement">Requirement</option></Select></label>
            <label>Source attachment<Select aria-label="Source attachment" value={sourceMode} onChange={e => update({ sourceMode: e.target.value })}>
              <option value="none">No source reference (supply reason)</option>
              <option value="artifact" disabled={!ctx.workspace?.artifacts?.length}>Anchor to captured artifact</option>
              <option value="external">External source URI</option>
            </Select></label>
          </div>
          <label>Title<Input value={title} required maxLength={200} placeholder="Concise summary of the requirement or decision" onChange={e => update({ title: e.target.value })} /></label>
          <label>Content<Textarea rows={3} required value={content} maxLength={65536} placeholder="State the requirement, architectural constraint, or technical rationale…" onChange={e => update({ content: e.target.value })} /></label>
          {sourceMode === 'none' && (
            <label>Why is no source reference supplied?<Textarea rows={2} required value={reason} maxLength={4000} placeholder="e.g., Team architecture meeting or design decision prior to code changes" onChange={e => update({ reason: e.target.value })} /></label>
          )}
          {sourceMode === 'artifact' && anchoredArtifact && (
            <div className="service-record-anchor-box">
              {seed?.artifact?.artifactId === anchoredArtifact.artifactId && (
                <p className="service-seed-note">Preselected from Code explorer: Lines {form.anchorStart}–{form.anchorEnd}</p>
              )}
              <label>
                Anchored artifact
                <Select aria-label="Anchored artifact" value={anchoredArtifact.artifactId} onChange={e => update({ anchorArtifactId: e.target.value, anchorStart: '', anchorEnd: '' })}>
                  {(ctx.workspace?.artifacts || []).map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity?.title || a.path}</option>)}
                </Select>
              </label>
              <SourceLinePicker
                ctx={ctx}
                repositoryId={ctx.selection.repositoryId}
                artifact={anchoredArtifact}
                startLine={form.anchorStart}
                endLine={form.anchorEnd}
                disabled={!ctx.canWrite || ctx.busy}
                onChangeRange={(anchorStart, anchorEnd) => update({ anchorStart, anchorEnd })}
              />
            </div>
          )}
          {sourceMode === 'external' && (
            <div className="service-form-grid-2">
              <label>External label<Input required maxLength={200} value={form.externalLabel} placeholder="e.g. RFC-042 or Jira ENG-128" onChange={e => update({ externalLabel: e.target.value })} /></label>
              <label>External URI<Input required maxLength={2048} value={form.externalUri} placeholder="https://example.org/adr/042" onChange={e => update({ externalUri: e.target.value })} /></label>
            </div>
          )}
          {codeArtifacts.length > 0 && (
            <div className="service-record-link-box">
              <label className="service-checkbox">
                <Checkbox checked={Boolean(form.alsoLink)} onChange={e => update({ alsoLink: e.target.checked })} />
                <span>
                  Also propose an unconfirmed <strong>{kind === 'decision' ? 'motivates' : 'implements'}</strong> relationship to Python code
                  <small className="service-checkbox-sub">Separate action: the proposed link enters as an unconfirmed candidate for review.</small>
                </span>
              </label>
              {form.alsoLink && linkTarget && (
                <div className="service-record-anchor-box">
                  <label>
                    Target code artifact
                    <Select aria-label="Target code artifact" value={linkTarget.artifactId} onChange={e => update({ linkTargetId: e.target.value, linkStart: '', linkEnd: '' })}>
                      {codeArtifacts.map(a => <option key={a.artifactId} value={a.artifactId}>{a.path}</option>)}
                    </Select>
                  </label>
                  <SourceLinePicker
                    ctx={ctx}
                    repositoryId={ctx.selection.repositoryId}
                    artifact={linkTarget}
                    startLine={form.linkStart}
                    endLine={form.linkEnd}
                    disabled={!ctx.canWrite || ctx.busy}
                    defaultOpen={!seed?.artifact}
                    onChangeRange={(linkStart, linkEnd) => update({ linkStart, linkEnd })}
                  />
                  <label>Candidate link rationale<Textarea rows={2} value={form.linkReason} maxLength={4000} placeholder={`Explain why this ${kind} relates to ${linkTarget.path}…`} onChange={e => update({ linkReason: e.target.value })} /></label>
                </div>
              )}
            </div>
          )}
          {(!hasAnchorRange || !hasLinkRange) && (
            <p className="service-method">Select source line numbers before saving an anchored record or proposed link.</p>
          )}
          {ctx.error && <p className="form-error" role="alert">{ctx.error}</p>}
          {ctx.notice && <p role="status">{ctx.notice}</p>}
        </div>
        <div className="service-dialog-footer">
          <Button variant="unstyled" type="submit" className="btn btn--accent" disabled={!canSubmit}>Save record</Button>
          <Button variant="secondary" type="button" onClick={ctx.closeModal}>Cancel</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

function SnapshotDialog({ ctx, open, onOpenChange }) {
  const repoName = ctx.state.repositories.find(r => r.id === ctx.selection?.repositoryId)?.fullName || 'Repository';
  const inventory = ctx.workspace?.gitInventory;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="service-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="snapshot-details-title" aria-describedby="snapshot-details-desc">
      <div className="service-dialog-head">
        <div>
          <DialogTitle id="snapshot-details-title">Revision &amp; snapshot details</DialogTitle>
          <DialogDescription id="snapshot-details-desc">Inspect the exact commit selection or switch to a retained historical snapshot.</DialogDescription>
        </div>
        <Button variant="unstyled" className="btn service-dialog-close" onClick={() => onOpenChange(false)} aria-label="Close snapshot details"><X size={18} /></Button>
      </div>
      <div className="service-dialog-body journey-form">
        {ctx.selection && (
          <div className="service-snapshot-meta-card">
            <div><span>Repository</span><strong>{repoName}</strong></div>
            <div><span>Context kind</span><strong>{ctx.selection.baseRevision ? 'Revision comparison' : 'Initial snapshot'}</strong></div>
            <div><span>Commit</span><code className="service-id">{ctx.selection.targetRevision.commitId}</code></div>
            <div><span>Snapshot</span><strong>Version {ctx.workspace?.snapshot.snapshotVersion ?? 'loading'} ({ctx.workspace?.mode})</strong></div>
          </div>
        )}
          {inventory && <section aria-label="Git file inventory">
            <strong>{inventory.capturedPaths} captured files</strong>
            <p>{inventory.treeEntries} entries in the Git tree · {inventory.selectedPaths == null ? 'Whole tree selected' : `${inventory.selectedPaths} paths requested`}</p>
            {inventory.excluded.length > 0 && <details><summary>{inventory.excluded.length} excluded paths</summary>
              <ul>{inventory.excluded.map(({ path, reason }) => <li key={path}><code>{path}</code> · {reason}</li>)}</ul>
            </details>}
          </section>}
          <label>Retained snapshot<Select aria-label="Retained snapshot" value={ctx.workspace.snapshot.id} disabled={ctx.busy} onChange={async e => { await ctx.openSnapshot(e.target.value); onOpenChange(false); }}>{ctx.retainedSnapshots.map(s => <option value={s.snapshotId} key={s.snapshotId}>Version {s.snapshotVersion} · {s.mode}</option>)}{!ctx.retainedSnapshots.some(s => s.snapshotId === ctx.workspace.snapshot.id) && <option value={ctx.workspace.snapshot.id}>Version {ctx.workspace.snapshot.snapshotVersion} · {ctx.workspace.mode}</option>}</Select></label>
        {ctx.workspace.mode === 'historical' && (
          <p className="service-scoped-note">Historical snapshots are read-only. Use Refresh or select the active version to record new judgments.</p>
        )}
      </div>
      <div className="service-dialog-footer">
        <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>Close</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function CompareDialog({ ctx, open, onOpenChange }) {
  const repoDesc = ctx.descriptor?.repositories.find(r => r.id === ctx.selection?.repositoryId);
  const revisionChoices = allSelections(repoDesc);
  const choices = ctx.workspace.progress?.capturedChoices || [];
  const [target, setTarget] = useState(ctx.selection.targetRevision.commitId);
  const { baselineOptions, initialOptions, defaultBaseKey } = buildCompareOptions({
    revisionChoices,
    capturedChoices: choices,
    currentSelection: ctx.selection,
    targetCommit: target,
  });
  const [baseOverride, setBase] = useState(null);
  const base = baseOverride ?? defaultBaseKey;
  const selectedBaseOpt = baselineOptions.find(o => o.key === base)
    || baselineOptions.find(o => o.key === defaultBaseKey)
    || baselineOptions[0];
  const selectedTargetOpt = initialOptions.find(o => o.commitId === target);
  const baseCaptured = base === 'current'
    ? ctx.workspace.snapshot.coverage.some(c => c.function === 'ingestion' && c.status === 'complete')
    : Boolean(selectedBaseOpt?.captured);
  const targetCaptured = Boolean(selectedTargetOpt?.captured);
  const comparisonReady = baseCaptured && targetCaptured;
  const captureInProgress = ctx.workspace.progress?.operations.some(op => op.kind === 'capture' && ['queued', 'running'].includes(op.status));
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="service-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="compare-revisions-title" aria-describedby="compare-revisions-desc">
      <div className="service-dialog-head">
        <div>
          <DialogTitle id="compare-revisions-title">Compare revisions</DialogTitle>
          <DialogDescription id="compare-revisions-desc">Choose a baseline and an incoming revision to see which files and relationships need review.</DialogDescription>
        </div>
        <Button variant="unstyled" className="btn service-dialog-close" onClick={() => onOpenChange(false)} aria-label="Close comparison dialog"><X size={18} /></Button>
      </div>
      <form className="service-dialog-form" onSubmit={async e => {
        e.preventDefault();
        try {
          const targetSelection = selectedTargetOpt?.selection || { ...ctx.selection, comparisonId: undefined, baseRevision: null, targetRevision: { objectAlgorithm: 'sha1', commitId: target } };
          let baseSnapshotId;
          if (base === 'current') {
            baseSnapshotId = ctx.workspace.snapshot.id;
          } else if (selectedBaseOpt?.kind === 'comparison' && selectedBaseOpt.snapshotId) {
            baseSnapshotId = selectedBaseOpt.snapshotId;
          } else {
            const baseChoice = selectedBaseOpt?.selection || { ...ctx.selection, comparisonId: undefined, baseRevision: null, targetRevision: { objectAlgorithm: 'sha1', commitId: base.replace(/^init:/, '') } };
            const before = await ctx.api.query(ctx.selection.repositoryId, 'select_context', baseChoice);
            baseSnapshotId = before.snapshot.id;
          }
          const after = await ctx.api.query(ctx.selection.repositoryId, 'select_context', targetSelection);
          const res = await ctx.submit(contextEnvelope(targetSelection, { viewId: after.repositoryViewId }, 'compare_revisions', { baseSnapshotId, targetSnapshotId: after.snapshot.id }));
          if (res) { ctx.switchModule('changes'); onOpenChange(false); }
        } catch (error) { ctx.report(error); }
      }}>
        <div className="service-dialog-body journey-form">
          <label>Baseline<Select value={base === 'current' ? 'current' : (selectedBaseOpt?.key || '')} onChange={e => setBase(e.target.value)}><option value="current">Current snapshot · {ctx.selection.targetRevision.commitId.slice(0, 7)}{ctx.workspace?.revisionMeta?.target?.subject ? ` — ${ctx.workspace.revisionMeta.target.subject}` : ''}</option>{baselineOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}{opt.captured ? '' : ' (not yet captured)'}</option>)}</Select></label>
          <label>Target revision<Select value={target} onChange={e => setTarget(e.target.value)}>{revisionChoices.map(r => {
            const opt = initialOptions.find(o => o.commitId === r.selection.targetRevision.commitId);
            return <option key={`${r.selection.inventoryId}-${r.selection.targetRevision.commitId}`} value={r.selection.targetRevision.commitId}>{r.label} · {r.selection.targetRevision.commitId.slice(0, 7)}{r.subject ? ` — ${r.subject}` : ''}{opt?.captured ? '' : ' (not yet captured)'}</option>;
          })}</Select></label>
          {!comparisonReady && (
            <p className="service-reconfirm-hint" role="note">
              {captureInProgress ? 'Capturing files. Compare will be available when both revisions are ready.' : 'Capture both revisions before comparing. Open the uncaptured revision and choose Capture accepted files.'}
            </p>
          )}
        </div>
        <div className="service-dialog-footer">
          <Button type="submit" disabled={!ctx.canWrite || ctx.busy || !comparisonReady}>Compare and review impact</Button>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

const STEP_META = {
  capture: { icon: FolderGit2, hint: 'Capture accepted Python, Markdown, and plain-text blobs with SHA-256 verification' },
  discovery: { icon: Sparkles, hint: 'Run Tree-sitter AST + Docling extraction to propose unconfirmed candidates' },
  review: { icon: ListChecks, hint: 'Inspect exact line evidence and record accountable human judgments' },
  compare: { icon: GitCompare, hint: 'Diff retained revisions via native Git to surface directly affected links' },
  revalidate: { icon: RefreshCw, hint: 'Reconfirm or retire stale relationships with prior rationale visible' },
};

function ArchitecturePipelineStrip() {
  const stages = [
    { icon: FolderGit2, label: 'GitHub', tip: 'Bounded immutable commit & blob inventory' },
    { icon: Layers, label: 'Redis / RQ', tip: 'Durable background capture, discovery & export queue' },
    { icon: Cpu, label: 'Tree-sitter + Docling', tip: 'Python AST & Markdown extraction at file scope' },
    { icon: Network, label: 'Neo4j', tip: 'Projected artifact graph & 1-hop Cypher traversal' },
    { icon: GitCompare, label: 'Git Diff', tip: 'Retained-byte comparison & 1-hop impact set' },
  ];
  return (
    <div className="service-arch-strip" aria-label="Active backend pipeline">
      {stages.map((stage, i) => {
        const StageIcon = stage.icon;
        return (
          <span className="service-arch-node-wrap" key={stage.label}>
            {i > 0 && <ArrowRight size={11} className="service-arch-arrow" aria-hidden="true" />}
            <Tooltip content={stage.tip}>
              <span className="service-arch-pill">
                <StageIcon size={12} aria-hidden="true" />
                <span>{stage.label}</span>
              </span>
            </Tooltip>
          </span>
        );
      })}
    </div>
  );
}

function WorkspaceProgress({ ctx, onOpenCompare }) {
  const progress = ctx.workspace.progress;
  if (!progress) return <section className="card card--p-sm" role="status">Progress is unavailable. Refresh to read service state.</section>;
  const labels = { sources: 'Capture or inspect sources', discovery: 'Run discovery or inspect results', review: 'Inspect suggestions', compare: 'Choose revisions', incoming: 'Revalidate affected links' };
  const modules = { sources: progress.steps[0].state === 'complete' ? 'files' : 'governance', discovery: 'governance', review: 'changes', incoming: 'changes' };
  const currentResults = new Set(progress.operations.filter(o => ['complete', 'partial'].includes(o.status)).map(o => o.kind));
  const hasPublishedResult = op => ['failed', 'cancelled'].includes(op.status) && currentResults.has(op.kind);
  const activeAlerts = progress.operations.filter(op => op.status !== 'complete' && !hasPublishedResult(op));
  const otherAttempts = progress.operations.filter(hasPublishedResult);
  const captureReady = progress.steps[0]?.state === 'complete';
  const compareChoicesCount = progress.capturedChoices?.length || 0;
  return <section className="card card--p-sm service-progress" aria-label="Repository progress">
    <div className="service-progress__header">
      <div className="service-progress__title-row">
        <h2>Suggested workflow</h2>
        <Tooltip content="Optional progression: capture files, inspect discovered suggestions or explore code anytime, compare revisions with Git, and revalidate stale links.">
          <span className="service-info-dot" aria-label="Workflow guide"><Info size={14} aria-hidden="true" /></span>
        </Tooltip>
      </div>
      <div className="service-progress__meta-actions">
        <Tooltip content="You can explore captured sources or compare revisions anytime without confirming every candidate.">
          <span className="service-metric-pill"><Info size={12} aria-hidden="true" />Optional candidate review</span>
        </Tooltip>
        {ctx.workspace.mode === 'historical' && <span className="service-breakdown-pill">Retained snapshot: inspection only</span>}
      </div>
    </div>
    <ol className="service-progress-steps">{progress.steps.map((step, index) => {
      const meta = STEP_META[step.id] || { icon: GitCommit, hint: step.label };
      const StepIcon = meta.icon;
      const isCurrent = progress.currentStep === step.id;
      const showBlocker = (step.id === 'review' && progress.baseline.pending > 0 ? [] : step.blockers).filter(() => isCurrent || ['blocked', 'partial', 'unknown'].includes(step.state));
      const canCompareAction = step.action === 'compare' && captureReady && compareChoicesCount > 0 && onOpenCompare;
      return <li key={step.id} className={`service-progress-step ${isCurrent ? 'is-current' : ''} is-state-${step.state}`} aria-current={isCurrent ? 'step' : undefined}>
        <div className="service-progress-step__top">
          <Tooltip content={meta.hint}>
            <span className="service-step-badge">
              <span className="service-step-num" aria-hidden="true">{index + 1}</span>
              <StepIcon size={12} aria-hidden="true" />
            </span>
          </Tooltip>
          <span className={`service-chip service-chip--step-${step.state}`}>{step.state.replaceAll('_', ' ')}{isCurrent && step.id !== 'review' ? ' · current' : ''}</span>
        </div>
        <strong>{step.label}</strong>
        <div className="service-progress-step__body">
          {showBlocker.slice(0, 1).map((text, i) => (
            <Tooltip key={i} content={text}>
              <p className="service-step-hint-line">{text}</p>
            </Tooltip>
          ))}
          {step.id === 'review' && (
            <div className="service-step-metrics">
              <Tooltip content="Formally confirmed or rejected relationships"><span className="service-step-pill"><CheckCircle2 size={11} aria-hidden="true" />{progress.counts.reviewed} formally reviewed</span></Tooltip>
              <Tooltip content="Optional unconfirmed suggestions"><span className="service-step-pill"><Clock size={11} aria-hidden="true" />{progress.counts.pending} suggestions</span></Tooltip>
              {(progress.counts.triaged || 0) > 0 && <Tooltip content="Deferred or screened suggestions retained in snapshot"><span className="service-step-pill">{progress.counts.triaged} triaged</span></Tooltip>}
              {progress.baseline.rejected > 0 && <Tooltip content="Rejected"><span className="service-step-pill"><X size={11} aria-hidden="true" />{progress.baseline.rejected}</span></Tooltip>}
            </div>
          )}
          {step.id === 'revalidate' && progress.comparisonPublished && (
            <div className="service-step-metrics">
              <Tooltip content="Stale links needing reconfirmation or retirement"><span className="service-step-pill is-warn"><AlertTriangle size={11} aria-hidden="true" />{progress.counts.stale} stale</span></Tooltip>
              <Tooltip content="Unresolved candidates"><span className="service-step-pill"><Clock size={11} aria-hidden="true" />{progress.counts.unresolvedCandidate ?? progress.counts.candidate}</span></Tooltip>
            </div>
          )}
        </div>
        {canCompareAction && (
          <Button variant="ghost" size="sm" onClick={onOpenCompare}>{labels.compare}</Button>
        )}
        {step.action !== 'compare' && (isCurrent || ['failed', 'blocked', 'partial', 'not_started'].includes(step.state) || step.id === 'discovery' || step.id === 'sources') && <Button variant={isCurrent && step.id !== 'review' ? 'secondary' : 'ghost'} size="sm" disabled={step.id === 'revalidate' && !progress.comparisonPublished} onClick={() => {
          if (step.id === 'discovery' && step.state === 'complete') {
            ctx.switchModule('coverage');
          } else {
            if (step.action === 'review' && progress.comparisonPublished) ctx.changeSelection(progress.baseline.selection);
            ctx.switchModule(modules[step.action], step.id === 'revalidate' ? { queueTab: 'attention' } : null);
          }
        }}>{step.action === 'review' && progress.comparisonPublished ? 'Open baseline review' : step.id === 'discovery' && step.state === 'complete' ? 'View discovery coverage' : labels[step.action]}</Button>}
      </li>;
    })}</ol>
    {activeAlerts.length > 0 && <div className="service-progress-alerts">{activeAlerts.map(o => <p className="inline-notice" role="status" key={o.id}>{o.kind}: {o.status}{o.limitations.length ? ` · ${o.limitations.join(' ')}` : ''}</p>)}</div>}
    {otherAttempts.length > 0 && <Disclosure trigger="Processing attempt history" badge={otherAttempts.length} variant="subtle">
      <ul>{otherAttempts.map(op => <li key={op.id}>{op.kind}: {op.status}. {op.limitations.join(' ')}</li>)}</ul>
    </Disclosure>}
  </section>;
}

function Content({ ctx, onOpenCompare }) {
  const module = ctx.state.activeModule;
  const homeSignalMap = useMemo(() => {
    const map = new Map();
    for (const row of ctx.rows) {
      map.set(row.id, classifyCandidateSignal(row, ctx.rows));
    }
    return map;
  }, [ctx.rows]);
  const pendingRows = useMemo(
    () => ctx.rows
      .filter(row => row.projection.resolution === 'open')
      .sort((a, b) => rowPriorityRank(a, homeSignalMap) - rowPriorityRank(b, homeSignalMap)),
    [ctx.rows, homeSignalMap]
  );
  if (module === 'account') {
    const repos = ctx.descriptor?.repositories || [];
    const initials = (ctx.session.displayName || ctx.session.actorId || 'U').slice(0, 2).toUpperCase();
    return <div className="service-account-layout service-settings">
      <section className="card card--p-sm service-account-card">
        <div className="service-account-card__head">
          <span className="service-account-avatar">{initials}</span>
          <div>
            <h2>{ctx.session.displayName}</h2>
            <p className="service-method">Signed in to this Continuum instance</p>
          </div>
          <Button variant="secondary" disabled={ctx.busy} onClick={ctx.signOut}><LogOut size={15} />Sign out</Button>
        </div>
        <div className="service-account-meta">
          <div><Clock size={14} /><span>Session expires <strong>{formatTimestamp(ctx.session.absoluteExpiresAt)}</strong></span></div>
        </div>
      </section>
      <section className="card card--p-sm service-account-card">
        <h3>Granted repositories ({repos.length})</h3>
        <div className="service-account-repos">
          {repos.map(repo => <div className="service-account-repo-row" key={repo.id}>
            <div>
              <strong>{repo.inputs?.[0]?.repositoryFullName || repo.name}</strong>
              <small>{new Set((repo.inputs || []).flatMap(input => (input.revisions || []).map(revision => revision.commitId))).size} registered revisions</small>
            </div>
            <span className="service-breakdown-pill">{repo.role}</span>
          </div>)}
          {!repos.length && <p className="service-empty-note">No repository grants are assigned to this account.</p>}
        </div>
      </section>
      <section className="card card--p-sm service-account-card">
        <div className="service-account-card__head">
          <div>
            <h3>Appearance</h3>
            <p className="service-method">{ctx.theme === 'dark' ? 'Dark mode is active.' : 'Light mode is active.'}</p>
          </div>
          <Button variant="secondary" onClick={ctx.toggleTheme}>{ctx.theme === 'dark' ? <><Sun size={15} />Switch to Light mode</> : <><Moon size={15} />Switch to Dark mode</>}</Button>
        </div>
      </section>
      <section className="card card--p-sm service-account-card">
        <Disclosure trigger="Session and draft details" variant="subtle">
          <p className="service-method">Unsent review drafts stay in this browser under your account. The server checks repository access on every request.</p>
          <p className="service-id">Account ID {ctx.session.actorId}</p>
        </Disclosure>
      </section>
    </div>;
  }
  if (!ctx.workspace) return <section className="card card--p-sm">
    <h2>{ctx.busy ? 'Loading your workspace…' : ctx.descriptor?.capabilities?.customWorkspaces ? 'Connect your repository' : 'No workspace available'}</h2>
    <p>{ctx.busy ? 'Reading the selected repository snapshot.' : ctx.descriptor?.capabilities?.customWorkspaces ? 'Choose a source and revision to start reviewing changes with your team.' : 'Ask your Continuum operator for access to a repository with a registered input.'}</p>
    {!ctx.busy && ctx.descriptor?.capabilities?.customWorkspaces && (
      <div className="service-toolbar">
        <Button variant="primary" size="sm" onClick={() => ctx.openWorkspaceModal('create')}>
          <FolderPlus size={14} /> New custom workspace
        </Button>
      </div>
    )}
  </section>;
  if (module === 'files') return <Files key={`${ctx.selection?.repositoryId || ''}-${ctx.selection?.targetRevision?.commitId || ''}-${ctx.workspace?.mode || ''}`} ctx={ctx} />;
  if (module === 'changes') return <Relationships ctx={ctx} />;
  if (module === 'explore') return <>
    <section className="service-graph-workbench" aria-label="Relationship graph">
      <ServiceGraph key={ctx.workspace.snapshot.id} ctx={ctx} />
    </section>
    <Disclosure trigger={`Browse relationship list (${ctx.rows.length})`} variant="card">
      <Relationships heading={false} ctx={ctx} />
    </Disclosure>
  </>;
  if (module === 'coverage') return <section className="service-coverage">
    <div className="service-section-heading"><div><h2>Processing coverage</h2><p>Each status describes work on the selected revision. Open a row’s scope to see what the run could process.</p></div></div>
    {ctx.workspace.gitInventory && <div className="service-inventory-line">
      <FolderGit2 size={18} aria-hidden="true" />
      <strong>{ctx.workspace.gitInventory.capturedPaths} captured files</strong>
      <span>{ctx.workspace.gitInventory.treeEntries} Git tree entries</span>
      <span>{ctx.workspace.gitInventory.excluded.length} excluded</span>
    </div>}
    <div className="service-coverage-table"><div className="service-coverage-heading" aria-hidden="true"><span>Function</span><span>Status</span><span>Processed / Eligible</span></div>{ctx.workspace.snapshot.coverage.map(c => <section className="service-coverage-row" key={c.function}><div><h3>{c.function.replaceAll('_', ' ')}</h3><small>{c.excludedCount ?? 'Unknown'} excluded</small></div><span className={`service-chip service-chip--${c.status}`}>{c.status}</span><span className="service-coverage-count">{c.processedCount} / {c.eligibleCount ?? 'unknown'}</span>{!!c.limitations.length && <div className="service-coverage-disclosure"><Disclosure trigger="Scope & limitations" variant="subtle"><ul>{c.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></Disclosure></div>}</section>)}</div>
    <Limitations ctx={ctx} />
    <Disclosure trigger="Processing pipeline" variant="subtle"><ArchitecturePipelineStrip /></Disclosure>
  </section>;
  if (module === 'governance') {
    const repo = ctx.descriptor.repositories.find(r => r.id === ctx.selection.repositoryId);
    const activeInput = repo?.inputs?.find(i => i.id === ctx.selection.inventoryId);
    const isCustomRepo = repo?.inputs?.some(i => i.isCustom);
    return <div className="service-governance-layout service-settings">
      <div className="service-governance-grid">
        <section className="card card--p-sm">
          <h2>Repository access</h2>
          <div className="service-gov-meta"><strong>{repo?.name}</strong><span className="service-breakdown-pill">{repo?.role}</span></div>
          <p>Your Continuum operator manages repository access. Reviewers can capture revisions and record judgments.</p>
          {ctx.descriptor?.capabilities?.customWorkspaces && (
            <div className="service-toolbar">
              <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={() => ctx.openWorkspaceModal('create')}>
                <FolderPlus size={14} /> New custom workspace
              </Button>
              {isCustomRepo && repo?.role === 'reviewer' && (
                <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={() => ctx.openWorkspaceModal('add_revision')}>
                  <GitCommit size={14} /> Add revision to workspace
                </Button>
              )}
            </div>
          )}
        </section>
        <section className="card card--p-sm">
          <h2>Process this revision</h2>
          <p>Capture the {activeInput?.pathCount || 0} registered paths, then look for suggested relationships.</p>
          <div className="service-toolbar">{[['capture_files', 'Capture accepted files'], ['discover_candidates', 'Discover unconfirmed candidates']].map(([command, label]) => <Button variant="unstyled" className="btn btn--secondary" disabled={!ctx.canWrite || ctx.busy} key={command} onClick={() => ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, command, { targetRevision: ctx.selection.targetRevision, inventoryId: ctx.selection.inventoryId, configurationId: ctx.selection.configurationId }))}>{label}</Button>)}</div>
        </section>
      </div>
      {ctx.operation && <section className="inline-notice service-operation-notice">
        <div className="service-operation-notice__head">
          <p>Operation {ctx.operation.operationId} · {ctx.operation.status}</p>
          <Button variant="unstyled" className="btn btn--secondary" disabled={ctx.busy} onClick={ctx.checkOperation}><RefreshCw size={13} />Check processing status</Button>
        </div>
        <Disclosure trigger="Operation details" variant="subtle" className="service-operation-details"><pre className="service-json">{JSON.stringify(ctx.operation, null, 2)}</pre></Disclosure>
      </section>}
      <Limitations ctx={ctx} />
    </div>;
  }
  if (module === 'summary') {
    const confirmedCount = ctx.rows.filter(r => r.projection.validity === 'confirmed').length;
    const rejectedCount = ctx.rows.filter(r => r.projection.validity === 'rejected').length;
    const retiredCount = ctx.rows.filter(r => r.projection.validity === 'retired').length;
    const staleCount = ctx.workspace.snapshot.staleReviewCount ?? ctx.rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open').length;
    const openCand = ctx.workspace.snapshot.openCandidateCount ?? ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open').length;
    const deferredCand = ctx.workspace.snapshot.deferredCount ?? ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'deferred').length;
    const screenedCand = ctx.workspace.snapshot.screenedCount ?? ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'screened').length;
    const unresolvedCand = ctx.workspace.snapshot.unresolvedCandidateCount ?? (openCand + deferredCand + screenedCand);
    const followUps = ctx.workspace.followUps || [];
    const contextById = new Map(ctx.rows.map(r => [r.id, r]));
    return <>
      <section className="service-summary-ledger" aria-labelledby="review-outcomes-title">
        <h2 id="review-outcomes-title">Review outcomes</h2>
        <dl>
          <div><dt>Need revalidation</dt><dd>{staleCount}<small>{staleCount > 0 ? 'Review the changed evidence' : 'No stale links to review'}</small></dd></div>
          <div><dt>Confirmed</dt><dd>{confirmedCount}<small>{rejectedCount} rejected · {retiredCount} retired</small></dd></div>
          <div><dt>Unconfirmed suggestions</dt><dd>{unresolvedCand}<small>{openCand} open · {deferredCand} deferred · {screenedCand} screened out</small></dd></div>
          <div><dt>Open follow-ups</dt><dd>{ctx.workspace.snapshot.openFollowUpCount}<small>Tracked below</small></dd></div>
        </dl>
        {staleCount > 0 && <Button variant="primary" size="sm" onClick={() => ctx.switchModule('changes', { queueTab: 'attention' })}>
          Review affected links <ArrowRight size={14} aria-hidden="true" />
        </Button>}
      </section>
      <CycleActions key={ctx.workspace.snapshot.id} ctx={ctx} />
      <section className="card card--p-sm service-followups-panel">
        <div className="service-section-heading"><h2>Follow-up work <span>{followUps.length}</span></h2><p>Corrective work remains separate from relationship validity.</p></div>
        {followUps.length > 0 ? <div className="service-followup-list">{followUps.map(w => {
          const row = contextById.get(w.contextId);
          return <div className="service-followup-item" key={w.id}><div className="service-followup-item__head"><strong>{w.kind.replaceAll('_', ' ')}</strong><span className="service-breakdown-pill">{w.status}</span></div><small className="service-id">{row ? `${row.sourceLabel || row.sourcePath} → ${row.targetLabel || row.targetPath}` : `Context ${w.contextId}`}</small><Button variant="ghost" size="sm" onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(w.contextId); }}>Inspect context <ArrowRight size={13} /></Button></div>;
        })}</div> : <p className="service-empty-note">No follow-up tasks recorded in this snapshot.</p>}
      </section>
      <Disclosure trigger={`All snapshot relationships (${ctx.rows.length})`} variant="card" className="service-limitations">
        <Relationships ctx={ctx} heading={false} />
      </Disclosure>
    </>;
  }
  const confirmedCount = ctx.rows.filter(r => r.projection.validity === 'confirmed').length;
  const staleCount = ctx.rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open').length;
  const openCandidateCount = ctx.rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open').length;
  const docCount = (ctx.workspace.artifacts || []).filter(a => a.kind === 'document').length;
  const codeCount = (ctx.workspace.artifacts || []).filter(a => a.kind === 'code').length;
  const recordCount = (ctx.workspace.artifacts || []).filter(a => ['requirement', 'decision'].includes(a.kind)).length;
  const ingestionReady = ctx.workspace.snapshot.coverage?.some(c => c.function === 'ingestion' && c.status === 'complete');
  const stalePreviewRows = pendingRows.filter(r => r.projection.validity === 'stale');
  const highModPreviewRows = pendingRows.filter(r => r.projection.validity !== 'stale' && homeSignalMap.get(r.id)?.tier !== 'low');
  const previewRows = staleCount > 0
    ? stalePreviewRows.slice(0, 4)
    : (highModPreviewRows.length > 0 ? highModPreviewRows : pendingRows).slice(0, 4);
  const targetCommitMeta = ctx.workspace?.revisionMeta?.target;
  const headline = !ingestionReady ? 'Capture this revision' : staleCount
    ? `${staleCount} ${staleCount === 1 ? 'link needs' : 'links need'} revalidation` : openCandidateCount
      ? `${openCandidateCount} ${openCandidateCount === 1 ? 'relationship' : 'relationships'} to inspect` : 'No relationship reviews pending';

  return <div className="service-home">
    <div className="service-home-workbench">
      <section className="focus-brief service-home-brief">
      <h2>{headline}</h2>
      <p>{!ingestionReady ? 'Capture the files at this commit to browse sources and find related evidence.'
        : staleCount > 0 ? 'Check whether the changed files still support the earlier judgments.'
          : openCandidateCount > 0 ? 'Open a suggestion to inspect the evidence and decide whether the link holds.'
            : 'Browse captured sources or add the next commit when you’re ready to compare.'}</p>
      {targetCommitMeta?.subject && (
        <div className="service-home-commit" aria-label="Active revision commit message">
          <GitCommit size={15} aria-hidden="true" />
          <div className="service-home-commit__body">
            <strong>{targetCommitMeta.subject}</strong>
            <small>
              {targetCommitMeta.authorName && <span>{targetCommitMeta.authorName}{targetCommitMeta.authorEmail ? ` <${targetCommitMeta.authorEmail}>` : ''}</span>}
              {targetCommitMeta.authoredAt && <span> · {formatTimestamp(targetCommitMeta.authoredAt)}</span>}
              <span> · Commit <code>{targetCommitMeta.commitId?.slice(0, 10) || ctx.selection?.targetRevision?.commitId?.slice(0, 10)}</code></span>
            </small>
          </div>
        </div>
      )}
      <div className="focus-brief__actions">
        {!ingestionReady ? (
          <Button onClick={() => ctx.switchModule('governance')}>Capture accepted files <ArrowRight size={15} /></Button>
        ) : staleCount > 0 ? (
          <>
            <Button onClick={() => ctx.switchModule('changes', { queueTab: 'attention' })}>Revalidate stale links ({staleCount}) <ArrowRight size={15} /></Button>
            <Button variant="secondary" onClick={() => ctx.switchModule('files')}><FileCode2 size={15} />Explore sources</Button>
          </>
        ) : (
          <>
            {openCandidateCount > 0 && <Button onClick={() => ctx.switchModule('changes', { queueTab: 'suggestions' })}>Review suggestions <ArrowRight size={15} /></Button>}
            <Button variant={openCandidateCount > 0 ? 'secondary' : 'primary'} onClick={() => ctx.switchModule('files')}><FileCode2 size={15} />Explore sources</Button>
            <Button variant="ghost" onClick={() => ctx.switchModule('explore')}><Network size={15} />Explore graph</Button>
          </>
        )}
      </div>
      <div className="focus-brief__summary">
        <Tooltip content="Captured files classified as code"><span className="service-brief-stat"><FileCode2 size={13} aria-hidden="true" />{codeCount} code files</span></Tooltip>
        <Tooltip content="Captured files classified as documents"><span className="service-brief-stat"><FileText size={13} aria-hidden="true" />{docCount} docs</span></Tooltip>
        {recordCount > 0 && <Tooltip content="Authored requirements and decisions"><span className="service-brief-stat"><ListChecks size={13} aria-hidden="true" />{recordCount} authored records</span></Tooltip>}
        {confirmedCount > 0 && <Tooltip content="Human-confirmed relationships"><span className="service-brief-stat"><CheckCircle2 size={13} aria-hidden="true" />{confirmedCount} confirmed</span></Tooltip>}
        {ctx.workspace.snapshot.openFollowUpCount > 0 && <Tooltip content="Independent corrective follow-ups"><span className="service-brief-stat"><AlertTriangle size={13} aria-hidden="true" />{ctx.workspace.snapshot.openFollowUpCount} follow-up{ctx.workspace.snapshot.openFollowUpCount === 1 ? '' : 's'}</span></Tooltip>}
      </div>
    </section>

    <section className="service-home-next" aria-labelledby="workspace-queue-title">
      <div className="service-section-heading">
        <div>
          <h2 id="workspace-queue-title">Review queue</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => ctx.switchModule('changes', staleCount > 0 ? { queueTab: 'attention' } : null)}>View all relationships <ArrowRight size={14} /></Button>
      </div>
      {previewRows.map(row => {
        const sig = homeSignalMap.get(row.id);
        return <Button variant="unstyled" className="service-home-record" key={row.id} onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(row.id); }}><ArtifactKindIcon kind={row.source?.kind} size={17} /><span><strong>{row.sourceLabel || row.sourcePath}</strong><small className="service-row-target"><span className="service-rel-tag">{row.assertion.type}</span><ArrowRight size={11} aria-hidden="true" />{row.targetLabel || row.targetPath}{sig && <span className={`service-signal-badge is-${sig.tier}`}>{sig.label}</span>}</small></span><ValidityChip validity={row.projection.validity} /><ChevronRight size={14} /></Button>;
      })}
      {!previewRows.length && <p className="service-empty-note">{ingestionReady ? 'No open suggestions or stale links in this snapshot.' : 'Capture accepted files to populate captured artifacts and candidate links.'}</p>}
    </section>
    </div>

    <WorkspaceProgress ctx={ctx} onOpenCompare={onOpenCompare} />
    <Limitations ctx={ctx} />
  </div>;
}

function Limitations({ ctx }) {
  return <Disclosure
    trigger={<span className="service-limitations-trigger"><ShieldCheck size={15} />Coverage and method limitations</span>}
    badge={ctx.workspace.snapshot.limitations.length}
    variant="card"
    className="service-limitations"
  >
    <ul>{ctx.workspace.snapshot.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
  </Disclosure>;
}

function ComparisonImpactCard({ ctx }) {
  const comparison = ctx.workspace?.comparison;
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphFullScope, setGraphFullScope] = useState(false);
  const impact = useMemo(
    () => buildImpactGraphData(ctx.workspace, ctx.rows),
    [ctx.workspace, ctx.rows]
  );
  if (!comparison || !['dashboard', 'changes'].includes(ctx.state.activeModule)) return null;
  const rowsByContext = new Map(ctx.rows.map(r => [r.id, r]));
  const artifacts = ctx.workspace.artifacts || [];
  const unresolvedRows = ctx.rows.filter(r => [r.assertion.source, r.assertion.target].some(e => e.availability !== 'available'));
  const graphEdges = ctx.rows
    .filter(r => r.projection.resolution !== 'superseded' && !unresolvedRows.includes(r))
    .map(r => ({
      id: r.id,
      from: r.assertion.source.artifactId,
      to: r.assertion.target.artifactId,
      label: `${r.assertion.type} · ${r.projection.validity}`,
      kind: r.projection.validity,
      impacted: impact.impactedContextIds.has(r.id) || r.projection.validity === 'stale',
    }));
  const showImpactSubset = !graphFullScope && impact.hasImpact;
  const connectedIds = new Set(graphEdges.flatMap(e => [e.from, e.to]));
  const connectedArtifacts = artifacts.length > 25
    ? artifacts.filter(a => connectedIds.has(a.artifactId) || impact.affectedIds.has(a.artifactId))
    : artifacts;
  const inlineNodes = showImpactSubset ? artifacts.filter(a => impact.affectedIds.has(a.artifactId)) : connectedArtifacts;
  const inlineEdges = showImpactSubset ? graphEdges.filter(e => impact.affectedIds.has(e.from) && impact.affectedIds.has(e.to)) : graphEdges;
  const shortEndpoint = (label, path) => (label && label !== path ? label : (path || '').split('/').at(-1));
  const canRenderInlineGraph = ctx.state.activeModule !== 'explore' && artifacts.length > 0;
  const prioritizedImpacts = [...comparison.impacts].sort((a, b) => {
    const ra = rowsByContext.get(a.contextId);
    const rb = rowsByContext.get(b.contextId);
    const sa = ra?.projection?.validity === 'stale' ? 0 : 1;
    const sb = rb?.projection?.validity === 'stale' ? 0 : 1;
    return sa - sb;
  });
  const staleImpacts = prioritizedImpacts.filter(imp => rowsByContext.get(imp.contextId)?.projection?.validity === 'stale');
  const priorityLinks = staleImpacts.length > 0 ? staleImpacts : prioritizedImpacts;
  const quickImpacts = priorityLinks.slice(0, 3);

  return (
    <section className="service-comparison-banner" aria-labelledby="change-impact-title">
      <div className="service-impact-head">
        <div>
          <h2 id="change-impact-title">Change impact</h2>
          <p>{comparison.changes.length} changed paths · {comparison.impacts.length} affected relationships
            {staleImpacts.length > 0 && <strong> · {staleImpacts.length} need revalidation</strong>}
          </p>
        </div>
        <div className="service-impact-head__actions">
          {staleImpacts.length > 0 && ctx.state.activeModule === 'dashboard' && (
            <Button variant="primary" size="sm" onClick={() => ctx.switchModule('changes', { queueTab: 'attention' })}>
              Review affected links <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )}
          {canRenderInlineGraph && (
            <Tooltip content={graphOpen ? 'Hide inline impact graph' : 'Show affected artifact graph'}>
              <Button variant="secondary" size="sm" aria-expanded={graphOpen} onClick={() => setGraphOpen(v => !v)}>
                <Network size={13} aria-hidden="true" />
                {graphOpen ? 'Hide graph' : 'Impact graph'}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <dl className="service-impact-revisions">
        {[['Baseline', comparison.baseRevision, ctx.workspace.revisionMeta?.base],
          ['Incoming revision', comparison.targetRevision, ctx.workspace.revisionMeta?.target]].map(([label, revision, meta]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><code>{revision.commitId.slice(0, 7)}</code>{meta?.subject && <span>{meta.subject}</span>}</dd>
          </div>
        ))}
      </dl>

      {quickImpacts.length > 0 && (
        <div className="service-impact-strip is-compact" aria-label="Priority affected links">
          <span className="service-impact-strip__label">{staleImpacts.length > 0 ? 'Revalidate first:' : 'Affected links:'}</span>
          {quickImpacts.map(imp => {
            const row = rowsByContext.get(imp.contextId);
            if (!row) return null;
            return (
              <Tooltip key={imp.contextId} content={`Inspect impacted ${row.assertion.type} link: ${shortEndpoint(row.sourceLabel, row.sourcePath)} → ${shortEndpoint(row.targetLabel, row.targetPath)}`}>
                <button type="button" className={`service-impact-link-pill ${row.projection.validity === 'stale' ? 'is-stale' : ''}`} onClick={() => ctx.selectArtifact(row.id)}>
                  <ValidityIcon validity={row.projection.validity} size={11} />
                  <span>{shortEndpoint(row.sourceLabel, row.sourcePath)}</span>
                  <ArrowRight size={10} aria-hidden="true" />
                  <span>{shortEndpoint(row.targetLabel, row.targetPath)}</span>
                </button>
              </Tooltip>
            );
          })}
          {priorityLinks.length > quickImpacts.length && <span className="service-impact-more">+{priorityLinks.length - quickImpacts.length} in the review list</span>}
        </div>
      )}

      {graphOpen && canRenderInlineGraph && (
        <div className="service-impact-graph-wrap">
          {impact.hasImpact && (
            <div className="service-impact-graph-toolbar">
              <span>{showImpactSubset ? `Showing ${inlineNodes.length} changed & affected artifacts` : `Showing all ${artifacts.length} snapshot artifacts`}</span>
              <button type="button" className="text-link" onClick={() => setGraphFullScope(v => !v)}>
                {showImpactSubset ? 'Show full snapshot graph' : 'Show affected only'}
              </button>
            </div>
          )}
          <Suspense fallback={<div className="service-graph-loading" role="status">Loading impact graph…</div>}>
            <TraceabilityFlow
              compact
              height={320}
              showMiniMap={false}
              rawNodes={inlineNodes.map(impact.enrichNode)}
              rawEdges={inlineEdges}
              selectedArtifactId={null}
              onSelectEdge={id => ctx.selectArtifact(id)}
              onSelectNode={id => {
                const linked = ctx.rows.find(r => impact.impactedContextIds.has(r.id) && (r.assertion.source.artifactId === id || r.assertion.target.artifactId === id))
                  || ctx.rows.find(r => r.assertion.source.artifactId === id || r.assertion.target.artifactId === id);
                if (linked) ctx.selectArtifact(linked.id);
                else ctx.openSource(id);
              }}
              theme={ctx.theme}
            />
          </Suspense>
        </div>
      )}

      <Disclosure trigger={`Changed files (${comparison.changes.length}) & comparison notes`} variant="subtle">
        <div className="service-impact-strip">
          {comparison.changes.map(c => (
            <span key={c.path} className={`service-change-pill is-${c.kind}`}>
              <AlertTriangle size={11} aria-hidden="true" />
              <span>{c.path}</span>
              <small>{c.kind.replaceAll('_', ' ')}</small>
            </span>
          ))}
        </div>
        {comparison.limitations.map(l => <p key={l}>{l}</p>)}
      </Disclosure>
    </section>
  );
}

export default function ServiceApp() {
  const ctx = useContinuum();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => { const handler = e => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) { ctx.closeModal(); ctx.closeCommandPalette(); ctx.closeInspector(); } if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ctx.openCommandPalette(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [ctx]);
  if (ctx.checking) return <main className="entry-page" role="status"><div className="service-checking"><InfinityIcon size={28} /><span>Checking your session…</span></div></main>;
  if (!ctx.session) return <Login ctx={ctx} />;
  const repository = ctx.descriptor?.repositories.find(repo => repo.id === ctx.selection?.repositoryId);
  const canAddRevision = ctx.descriptor?.capabilities?.customWorkspaces && repository?.role === 'reviewer'
    && repository.inputs.some(input => input.isCustom);
  const canCompare = ctx.canWrite && new Set((ctx.workspace?.progress?.capturedChoices || [])
    .map(choice => choice.selection.targetRevision.commitId)).size > 1;
  return <div className="service-app"><Shell {...ctx} onSwitchRepo={ctx.handleSwitchRepo} onOpenImportModal={() => ctx.switchModule('governance')} /><div className="workspace"><div className="workspace-body"><main className="canvas service-canvas" id="main-content" tabIndex={-1}>
    <header className="workspace-topline">
      <div>
        <h1>{({ dashboard: 'Workspace', changes: 'Review relationships', summary: 'Review summary', files: 'Code explorer', explore: 'Explore context', coverage: 'Coverage', account: 'Account', governance: 'Team & governance' })[ctx.state.activeModule]}</h1>
        <p className="service-page-context"><FolderGit2 size={13} />{ctx.state.repositories.find(r => r.id === ctx.state.activeRepoId)?.fullName || 'Repository workspace'}<span>·</span><span className="service-commit-pill">{ctx.selection?.targetRevision.commitId.slice(0, 7)}</span><span className="service-live-state">{ctx.workspace?.mode || 'No snapshot'}</span></p>
      </div>
      <div className="service-topline-actions">
        {ctx.workspace && <>
          {canAddRevision && <Button variant={canCompare ? 'secondary' : 'primary'} size="sm" disabled={ctx.busy}
            onClick={() => ctx.openWorkspaceModal('add_revision')}><GitCommit size={15} aria-hidden="true" />Add revision</Button>}
          <Tooltip content="Inspect commit details or switch to a historical snapshot">
            <Button variant="secondary" size="sm" onClick={() => setSnapshotOpen(true)}><GitCommit size={14} aria-hidden="true" />Revision &amp; snapshot details</Button>
          </Tooltip>
          <Tooltip content="Compare two captured revisions with Git to view change impact">
            <Button variant={canCompare && !ctx.workspace.comparison ? 'primary' : 'secondary'} size="sm" onClick={() => setCompareOpen(true)}><GitCompare size={14} />Compare revisions</Button>
          </Tooltip>
        </>}
        <Tooltip content="Reload latest snapshot state from PostgreSQL and Neo4j">
          <Button variant="secondary" size="sm" disabled={ctx.busy || !ctx.selection} onClick={ctx.refresh}><RefreshCw size={15} />Refresh</Button>
        </Tooltip>
      </div>
    </header>
    <ComparisonImpactCard key={ctx.selection?.comparisonId} ctx={ctx} />

    {ctx.error && <p className="inline-notice form-error" role="alert">{ctx.error}</p>}
    {ctx.notice && <div className="inline-notice service-notice-banner" role="status"><CheckCircle2 size={15} /><span>{ctx.notice}</span><button type="button" className="service-notice-dismiss" onClick={ctx.dismissNotice} aria-label="Dismiss notification"><X size={13} /></button></div>}
    {ctx.pending && !ctx.busy && <section className="inline-notice"><p>A request is retained for account {ctx.session.displayName}. Its result has not been reconciled. Retry sends the same request ID and input.</p><Button variant="unstyled" className="btn btn--secondary" disabled={ctx.busy} onClick={ctx.retryPending}>Retry retained request</Button></section>}
    {ctx.recoverableImport && !ctx.busy && <section className="inline-notice"><p>Your last repository import was interrupted. Resume to retrieve its workspace using the original request.</p><Button variant="unstyled" className="btn btn--secondary" onClick={ctx.resumeImport}>Resume import</Button></section>}
    {ctx.busy && <p className="service-busy-banner" role="status">Updating workspace…</p>}
    <Content ctx={ctx} onOpenCompare={() => setCompareOpen(true)} />
  </main>{ctx.state.inspectorOpen && <Inspector key={ctx.state.selectedArtifactId} ctx={ctx} />}</div></div>
    {ctx.modalOpen && <RecordDialog ctx={ctx} />}
    {ctx.workspaceModalMode && <CustomWorkspaceModal ctx={ctx} open onOpenChange={open => { if (!open) ctx.closeWorkspaceModal(); }} mode={ctx.workspaceModalMode} />}
    {ctx.workspace && snapshotOpen && <SnapshotDialog ctx={ctx} open={snapshotOpen} onOpenChange={setSnapshotOpen} />}
    {ctx.workspace && compareOpen && <CompareDialog key={ctx.selection.targetRevision.commitId} ctx={ctx} open={compareOpen} onOpenChange={setCompareOpen} />}
    {ctx.isCommandPaletteOpen && <Dialog open onOpenChange={open => !open && ctx.closeCommandPalette()}><DialogContent className="service-dialog service-search-dialog" padded={false} showClose={false} aria-labelledby="service-search-title" aria-describedby="service-search-description"><header className="service-search-header"><Search size={19} /><div><DialogTitle id="service-search-title">Search current snapshot</DialogTitle><DialogDescription id="service-search-description">Find captured relationships in the selected repository and revision.</DialogDescription></div><Button variant="ghost" size="icon-sm" onClick={ctx.closeCommandPalette} aria-label="Close search"><X size={18} /></Button></header><div className="service-search-body"><ServiceSearch ctx={ctx} /></div></DialogContent></Dialog>}
  </div>;
}
