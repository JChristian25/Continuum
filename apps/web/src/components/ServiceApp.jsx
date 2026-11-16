import { Button, Checkbox, Input, Select, Textarea, Dialog, DialogContent, DialogTitle, DialogDescription, Tabs, TabsList, TabsTrigger, TabsContent, Disclosure } from './ui/index.js';
import { useEffect, useMemo, useState } from 'react';
import {
  Infinity as InfinityIcon, ArrowRight, X, RefreshCw, Search, FileText, FileCode2,
  ChevronRight, ChevronDown, GitBranch, ShieldCheck, Eye, EyeOff, CheckCircle2, Copy, Check,
  GitCompare, ListChecks, LogOut, Shield, FolderGit2, Clock, Sun, Moon
} from 'lucide-react';
import Shell from './Shell.jsx';
import { useContinuum } from '../context/ContinuumBase.js';
import { contextEnvelope, permittedDecisions, optionalReason, reasonLabel } from '../data/serviceModel.js';
import { computeLineDiff } from '../data/diff.js';
import { rankEvidenceItems } from '../data/evidenceSignal.js';
import './service.css';

import { RelationshipEditor, RecordRevision, ServiceSearch, ServiceGraph, CycleActions } from './ServiceTools.jsx';

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
  const [login, setLogin] = useState('jc');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="entry-page"><header className="entry-brand"><InfinityIcon size={32} strokeWidth={1.5} /><span>Continuum</span></header><div className="entry-layout">
    <section className="entry-story"><h1>Good decisions deserve<br />a little continuity.</h1><p>Follow a change. Understand its connections. Leave the next person the context they need.</p><div className="entry-example"><span>Repository context</span><p>Exact sources. Inspectable decisions.</p><div><span>Code</span><ArrowRight size={15} /><span>Evidence</span><ArrowRight size={15} /><span>Your judgment</span></div></div><p className="entry-footnote">Your account opens the repositories granted to you.</p></section>
    <section className="auth-panel"><h2>Welcome back to Continuum.</h2><p>Sign in to pick up the thread of your repository.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await ctx.signIn(login, password); } catch (err) { setError(err.message); } finally { setPassword(''); setBusy(false); } }}>
      <div className="journey-field"><label htmlFor="service-login-username">Login</label><Input id="service-login-username" autoComplete="username" required value={login} onChange={e => setLogin(e.target.value)} placeholder="Enter your username" /></div>
      <div className="journey-field"><label htmlFor="service-login-password">Password</label><div className="password-field"><Input id="service-login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /><Button variant="unstyled" type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></div></div>
      {(error || ctx.error) && <p className="form-error" role="alert">{error || ctx.error}</p>}
      <Button variant="unstyled" type="submit" className="btn btn--accent auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></Button>
    </form><p className="auth-boundary">Accounts are provisioned by the local operator. Session access is stored in an HTTP-only cookie.</p><p className="auth-demo-link"><a className="text-link" href="?mode=demo">Explore synthetic demo workspace (?mode=demo) <ArrowRight size={13} /></a></p></section>
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

function Source({ source, defaultOpen = true }) {
  const [copied, setCopied] = useState(false);
  if (!source) return <p>Exact source is unavailable.</p>;
  const path = source.identity.path || source.identity.title || source.id;
  const lines = source.content.split('\n');
  const copySource = async () => {
    try {
      await navigator.clipboard?.writeText(source.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard permission optional */ }
  };
  return <section className="code-box service-source"><div className="code-box__header"><FileCode2 size={14} /><strong title={path}>{path}</strong><span>{lines.length} lines</span><button type="button" className="service-source-copy" onClick={copySource} aria-label={`Copy ${path}`}>{copied ? <Check size={12} /> : <Copy size={12} />}<span>{copied ? 'Copied' : 'Copy'}</span></button></div>
    <Disclosure trigger="Read captured source" defaultOpen={defaultOpen} variant="dark" className="service-source-content">
      <div className="code-box__body">{lines.map((line, i) => <div className="code-line" key={i}><span className="code-line__num">{i + 1}</span><span className="code-line__text">{line || ' '}</span></div>)}</div>
    </Disclosure>
    <Disclosure trigger="Exact version identity" variant="dark" className="service-source-identity">
      <pre className="service-json">{JSON.stringify({ id: source.id, identity: source.identity, digest: source.contentDigest }, null, 2)}</pre>
    </Disclosure>
  </section>;
}

function BatchConfirmDialog({ ctx, rows, onClose, onCompleted }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [inspected, setInspected] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    ctx.loadBatchEvidence(rows, abort.signal)
      .then(data => { if (!abort.signal.aborted) { setItems(data); setLoading(false); } })
      .catch(e => { if (!abort.signal.aborted && e.name !== 'AbortError') { setLoadError(e.message); setLoading(false); } });
    return () => abort.abort();
  }, [ctx, rows]);

  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="service-dialog service-batch-dialog" padded={false} showClose={false} aria-labelledby="batch-confirm-title" aria-describedby="batch-confirm-desc">
      <Button variant="unstyled" className="btn service-dialog-close" onClick={onClose} aria-label="Close batch review"><X size={18} /></Button>
      <DialogTitle id="batch-confirm-title">Review &amp; confirm {rows.length} relationships</DialogTitle>
      <DialogDescription id="batch-confirm-desc">Inspect the recorded evidence for each selected relationship before confirming. Each item is saved with its own accountable receipt.</DialogDescription>
      {loading && <p className="service-method" role="status">Loading exact recorded evidence…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loading && !loadError && <form className="journey-form" onSubmit={async e => {
        e.preventDefault();
        const res = await ctx.submitBatchJudgments(items, { decision: 'confirm', reason });
        if (res.succeeded > 0) onCompleted();
        onClose();
      }}>
        <div className="service-batch-evidence-list">
          {items.map(({ row, totalEvidence, evidence }) => <section className="service-batch-item" key={row.id}>
            <div className="service-batch-item__head">
              <strong>{row.sourceLabel || row.sourcePath}</strong>
              <span><span className="service-rel-tag">{row.assertion.type}</span> → {row.targetLabel || row.targetPath}</span>
              <small>{totalEvidence} anchor{totalEvidence === 1 ? '' : 's'}</small>
            </div>
            {evidence.map(ev => <div className="service-batch-excerpt" key={ev.id}>
              <small>{formatLocator(ev.locator)}</small>
              <pre className="service-excerpt">{ev.excerpt ?? ev.reason ?? 'No resolvable excerpt.'}</pre>
            </div>)}
          </section>)}
        </div>
        <label className="service-checkbox"><Checkbox checked={inspected} onChange={e => setInspected(e.target.checked)} />I inspected the recorded evidence for all {items.length} selected relationships.</label>
        <label>Reason (optional)<Textarea value={reason} maxLength={4000} placeholder="Shared rationale applied to each selected confirmation (optional)…" onChange={e => setReason(e.target.value)} /></label>
        <div className="service-toolbar">
          <Button type="submit" disabled={!ctx.canWrite || ctx.busy || !inspected || !items.length}>Confirm {items.length} relationships</Button>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>;
}

function Relationships({ ctx, onSelect, heading = true }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [viewMode, setViewMode] = useState(heading ? 'grouped' : 'flat');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const rows = ctx.rows.filter(r => `${r.sourcePath} ${r.targetPath} ${r.sourceLabel || ''} ${r.targetLabel || ''} ${r.assertion.methodId} ${r.assertion.type}`.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || r.projection.validity === status) && (reviewFilter === 'all' || r.projection.resolution === reviewFilter));
  const visibleIdsKey = rows.map(r => r.id).join(',');
  useEffect(() => {
    const ids = visibleIdsKey ? visibleIdsKey.split(',') : [];
    if (!ids.length) return;
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
  }, [visibleIdsKey, ctx]);

  const totalCount = ctx.rows.length;
  const openCount = ctx.rows.filter(r => r.projection.resolution === 'open').length;
  const resolvedCount = totalCount - openCount;
  const canBatch = heading && ctx.canWrite && ctx.workspace?.mode === 'active';
  const eligibleCandidates = canBatch ? rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open') : [];
  const selectedRows = eligibleCandidates.filter(r => selectedIds.has(r.id));
  const allEligibleSelected = eligibleCandidates.length > 0 && selectedRows.length === eligibleCandidates.length;

  const toggleSelect = id => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectGroup = groupRows => {
    const groupEligible = groupRows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open');
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

  // Group rows by source artifact label/path
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
    const isCandidate = row.projection.validity === 'candidate' && row.projection.resolution === 'open';
    const selectable = canBatch && isCandidate;
    const evCount = row.assertion?.evidenceIds?.length || 0;
    return <div className={`service-row-wrap ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''}`} key={row.id}>
      {selectable && <div className="service-row-check"><Checkbox aria-label={`Select ${row.sourceLabel || row.sourcePath} to ${row.targetLabel || row.targetPath}`} checked={selectedIds.has(row.id)} disabled={ctx.busy} onChange={() => toggleSelect(row.id)} /></div>}
      <Button variant="unstyled" className={`service-row ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''}`} onClick={() => { ctx.selectArtifact(row.id); onSelect?.(); }} disabled={ctx.busy}>
        <ArtifactKindIcon kind={row.source?.kind} size={16} className="service-row-icon" />
        <span className="service-row-paths">
          <strong title={row.sourcePath}>{row.sourceLabel || row.sourcePath}</strong>
          <small title={row.targetPath}><span className="service-rel-tag">{row.assertion.type}</span> → {row.targetLabel || row.targetPath}{evCount ? ` · ${evCount} anchor${evCount === 1 ? '' : 's'}` : ''}</small>
        </span>
        <span className="service-row-status"><span className={`service-chip service-chip--${row.projection.validity}`}>{row.projection.validity}</span><small>{row.projection.resolution}</small></span>
        <ChevronRight size={15} className="service-row-arrow" />
      </Button>
      {selectable && <Button variant="ghost" size="xs" className="service-row-dismiss" disabled={ctx.busy} title="Dismiss candidate (reject without reason)" aria-label={`Dismiss ${row.sourceLabel || row.sourcePath} to ${row.targetLabel || row.targetPath}`} onClick={() => ctx.quickReject(row)}>Dismiss</Button>}
    </div>;
  };

  return <section className="service-relationships">
    {heading && <div className="service-section-heading">
      <div>
        <h2>Connected artifacts <span>{rows.length}</span></h2>
        <p>{totalCount ? `${resolvedCount} of ${totalCount} reviewed` : 'Open any suggested link to inspect matched lines and record a decision'} · Use ↑/↓ arrows to step between rows.</p>
      </div>
      <div className="service-heading-actions">
        <div className="service-view-toggle" role="group" aria-label="Queue layout">
          <button type="button" className={viewMode === 'grouped' ? 'is-active' : ''} onClick={() => setViewMode('grouped')}>Grouped</button>
          <button type="button" className={viewMode === 'flat' ? 'is-active' : ''} onClick={() => setViewMode('flat')}>Flat</button>
        </div>
        <RelationshipEditor ctx={ctx} />
        {openCount > 0 && <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={() => ctx.selectNextOpen(ctx.state.selectedArtifactId)}>Review next open ({openCount}) <ArrowRight size={14} /></Button>}
      </div>
    </div>}
    <div className="service-filters"><label className="service-search-field">Search relationships<Input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by path or type…" /></label><label className="service-validity-field">Validity<Select value={status} onChange={e => setStatus(e.target.value)}>{['all', 'candidate', 'confirmed', 'rejected', 'stale', 'retired'].map(s => <option key={s}>{s}</option>)}</Select></label><label className="service-validity-field">Review state<Select aria-label="Filter by review state" value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}>{['all', 'open', 'resolved'].map(s => <option key={s}>{s}</option>)}</Select></label></div>
    {canBatch && eligibleCandidates.length > 0 && <div className="service-batch-bar">
      <label className="service-checkbox service-batch-selectall"><Checkbox checked={allEligibleSelected} disabled={ctx.busy} onChange={toggleSelectAll} /><span>Select all open candidates ({eligibleCandidates.length})</span></label>
      {selectedRows.length > 0 && <div className="service-batch-actions">
        <span className="service-batch-count">{selectedRows.length} selected</span>
        <Button variant="default" size="xs" disabled={ctx.busy} onClick={() => setBatchConfirmOpen(true)}>Review &amp; confirm ({selectedRows.length})</Button>
        <Button variant="secondary" size="xs" disabled={ctx.busy} onClick={async () => { const res = await ctx.submitBatchJudgments(selectedRows, { decision: 'reject' }); if (res.succeeded > 0) setSelectedIds(new Set()); }}>Reject selected ({selectedRows.length})</Button>
        <Button variant="ghost" size="xs" disabled={ctx.busy} onClick={() => setSelectedIds(new Set())}>Clear</Button>
      </div>}
    </div>}
    {viewMode === 'grouped' && grouped.length > 0 ? <div className="service-groups">
      {grouped.map(group => {
        const isCollapsed = !!collapsedGroups[group.key];
        const groupOpen = group.items.filter(r => r.projection.resolution === 'open').length;
        const groupEligible = group.items.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open');
        const groupAllSelected = groupEligible.length > 0 && groupEligible.every(r => selectedIds.has(r.id));
        return <div className="service-group-card" key={group.key}>
          <div className="service-group-header">
            {canBatch && groupEligible.length > 0 && <Checkbox aria-label={`Select all open in ${group.title}`} checked={groupAllSelected} disabled={ctx.busy} onChange={() => toggleSelectGroup(group.items)} />}
            <button type="button" className="service-group-toggle" aria-expanded={!isCollapsed} onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}>
              <ChevronDown size={15} className={`service-group-chevron ${isCollapsed ? 'is-collapsed' : ''}`} />
              <ArtifactKindIcon kind={group.kind} size={15} />
              <strong title={group.title}>{group.title}</strong>
              <span className="service-group-meta">{group.items.length} link{group.items.length === 1 ? '' : 's'}{groupOpen > 0 ? ` · ${groupOpen} open` : ' · all reviewed'}</span>
            </button>
          </div>
          {!isCollapsed && <div className="service-group-rows">{group.items.map(renderRow)}</div>}
        </div>;
      })}
    </div> : <div className="service-list service-relationship-list"><div className="service-list-heading" aria-hidden="true"><span>Connected artifacts</span><span>Validity / Review</span></div>{rows.map(renderRow)}{!rows.length && <div className="queue-empty"><Search size={24} /><strong>No matching relationships</strong><p>Try a different path, validity, or review state filter.</p></div>}</div>}
    {viewMode === 'grouped' && !rows.length && <div className="service-list service-relationship-list"><div className="queue-empty"><Search size={24} /><strong>No matching relationships</strong><p>Try a different path, validity, or review state filter.</p></div></div>}
    {batchConfirmOpen && selectedRows.length > 0 && <BatchConfirmDialog ctx={ctx} rows={selectedRows} onClose={() => setBatchConfirmOpen(false)} onCompleted={() => setSelectedIds(new Set())} />}
  </section>;
}

function Inspector({ ctx }) {
  const [tab, setTab] = useState('review');
  const [evidenceMode, setEvidenceMode] = useState('top');
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
  const decisions = d ? permittedDecisions(d.projection) : [];

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

  const hiddenEvidenceCount = Math.max(0, ranked.items.length - visibleEvidence.length);
  const srcName = sourceArt?.identity?.title || sourceArt?.path || d?.assertion.source.artifactId;
  const tgtName = targetArt?.identity?.title || targetArt?.path || d?.assertion.target.artifactId;
  const relationVerb = d ? ({ documents: 'documents', implements: 'implements', motivates: 'motivates' }[d.assertion.type] || d.assertion.type) : '';

  return <aside className="inspector service-inspector" aria-label="Relationship inspector"><header className="inspector__header"><div><h2>Relationship context</h2><p>Evidence, judgment & history</p></div><div className="service-header-actions">{otherOpenCount > 0 && <Button variant="ghost" size="sm" disabled={ctx.busy} onClick={() => ctx.selectNextOpen(d?.projection.contextId)}>Next open <ArrowRight size={14} /></Button>}<Button variant="unstyled" className="btn btn--ghost" aria-label="Close inspector" onClick={ctx.closeInspector}><X size={18} /></Button></div></header>
    {!d ? <p className="service-padding" role="status">{ctx.error ? 'Context could not be loaded.' : 'Loading exact evidence…'}</p> : <div className="inspector__body">
      <div className="service-inspector-status"><span className={`service-chip service-chip--${d.projection.validity}`}>{d.projection.validity}</span><span>{d.projection.resolution} review · {d.mode} snapshot</span></div>
      <div className="service-endpoints-summary" aria-label="Connected endpoints">
        <strong title={sourceArt?.path}>{srcName}</strong>
        <span><span className="service-rel-tag">{d.assertion.type}</span> → {tgtName}</span>
        <p className="service-claim-explainer">Question to decide: Does <code>{srcName?.split('/').at(-1)}</code> {relationVerb} <code>{tgtName?.split('/').at(-1)}</code>?</p>
      </div>
      {d.returnContextId ? <Button variant="secondary" size="sm" onClick={() => ctx.selectArtifact(d.returnContextId)}>Return to incoming review</Button> : impact && <section className="card card--p-sm service-prior-card" aria-label="Retained baseline decision">
        <div className="service-prior-card__head"><strong>Prior baseline decision</strong>{prior && <span className={`service-chip service-chip--${prior.validity}`}>{prior.decision || prior.validity}</span>}</div>
        {prior ? <>
          <p className="service-prior-card__meta">{prior.decision ? `${prior.actorDisplayName || prior.actorId || 'Reviewer'} · ${prior.recordedAt || ''}` : `Baseline state: ${prior.validity} (${prior.resolution})`}</p>
          <p className="service-prior-card__reason">{prior.decision ? reasonLabel(prior.reason) : 'No manual decision was recorded on the baseline context.'}</p>
        </> : <p className="service-prior-card__meta">Compare baseline context directly to inspect retained rationale and source anchors.</p>}
        <Button variant="secondary" size="sm" onClick={ctx.openPriorDecision}>Inspect prior decision & evidence</Button>
      </section>}
      <Tabs value={tab} onValueChange={setTab} className="service-tabs"><TabsList className="service-tabs-list service-tabs-list--two" aria-label="Relationship context views">{['review', 'history'].map(t => <TabsTrigger className="service-tabs-trigger" value={t} key={t}>{t}</TabsTrigger>)}</TabsList>
      <TabsContent className="service-tab-panel" value="review">
        {changedEndpoints.length > 0 && <Disclosure trigger="What changed since last review" badge={`${changedEndpoints.length} file${changedEndpoints.length === 1 ? '' : 's'}`} defaultOpen variant="card" className="service-diff-disclosure">
          {changedEndpoints.map(ep => <EndpointDiffBox key={ep.path} {...ep} />)}
        </Disclosure>}
        <div className="service-evidence-header">
          <div>
            <h3>Recorded evidence</h3>
            <p className="service-evidence-summary">{ranked.summary}</p>
          </div>
          <span className="service-breakdown-pill">{d.evidence.length} anchor{d.evidence.length === 1 ? '' : 's'}</span>
        </div>
        {ranked.items.length > 4 && <div className="service-evidence-filters" role="group" aria-label="Evidence signal filter">
          <button type="button" className={evidenceMode === 'top' ? 'is-active' : ''} onClick={() => setEvidenceMode('top')}>Top signals (4)</button>
          {ranked.directCount > 0 && <button type="button" className={evidenceMode === 'direct' ? 'is-active' : ''} onClick={() => setEvidenceMode('direct')}>Direct mentions ({ranked.directCount})</button>}
          <button type="button" className={evidenceMode === 'all' ? 'is-active' : ''} onClick={() => setEvidenceMode('all')}>All ({ranked.items.length})</button>
        </div>}
        <div className="service-evidence-list">
          {visibleEvidence.map(e => <div className="service-evidence-item" key={e.id}>
            <div className="service-evidence-item__head">
              <strong>{sourceByVersion.get(e.artifactVersionId) || 'Captured source'}</strong>
              <span className={`service-signal-pill tier-${e.signalTier}`}>{e.signalLabel}</span>
            </div>
            <div className="service-evidence-item__loc">{formatLocator(e.locator)}{e.availability !== 'available' ? ` · ${e.availability}` : ''}</div>
            {e.excerpt ? <HighlightExcerpt text={e.excerpt} tokens={e.sharedTokens} /> : <pre className="service-excerpt">{e.reason ?? 'No resolvable excerpt.'}</pre>}
          </div>)}
          {evidenceMode === 'top' && hiddenEvidenceCount > 0 && <div className="service-evidence-more">
            <Button variant="ghost" size="xs" onClick={() => setEvidenceMode('all')}>Show {hiddenEvidenceCount} more anchor{hiddenEvidenceCount === 1 ? '' : 's'} ({ranked.items.length} total)</Button>
          </div>}
          {evidenceMode !== 'top' && ranked.items.length > 4 && <div className="service-evidence-more">
            <Button variant="ghost" size="xs" onClick={() => setEvidenceMode('top')}>Show top 4 signals</Button>
          </div>}
        </div>
        <div className="service-sources-stack">
          {currentSources.map(s => <Source key={s.id} source={s} defaultOpen={false} />)}
        </div>
        <form className="journey-form service-judgment-form" onSubmit={e => { e.preventDefault(); ctx.saveJudgment(); }}>
          {decisions.length > 0 && <div className="service-decision-field">
            <span className="service-decision-label">Relationship judgment</span>
            <div className="service-decision-toggle" role="radiogroup" aria-label="Relationship judgment">
              {decisions.map(v => <button type="button" role="radio" aria-checked={draft.decision === v} key={v} disabled={!mutable} className={`service-decision-btn ${draft.decision === v ? 'is-selected' : ''}`} onClick={() => ctx.updateDraft({ decision: v })}>{v}</button>)}
            </div>
            <small className="service-decision-help">
              {decisions.includes('reconfirm')
                ? 'Reconfirm = still accurate after edits · Retire = link no longer applies.'
                : 'Confirm = evidence supports this link · Reject = unrelated or false suggestion.'}
            </small>
          </div>}
          {(['confirm', 'reconfirm'].includes(draft.decision) || !draft.decision) && decisions.some(v => ['confirm', 'reconfirm'].includes(v)) && (
            <label className="service-checkbox"><Checkbox checked={draft.inspected} disabled={!mutable} onChange={e => ctx.updateDraft({ inspected: e.target.checked })} />I inspected the exact sources and recorded evidence.</label>
          )}
          <label>{optionalReason(d, draft.decision) ? 'Reason (optional)' : 'Reason'}<Textarea value={draft.reason} disabled={!mutable} required={!optionalReason(d, draft.decision)} maxLength={4000} placeholder="Explain why this relationship is confirmed or rejected…" onChange={e => ctx.updateDraft({ reason: e.target.value })} /></label>
          <Disclosure trigger="Content concerns & follow-up" variant="card" className="service-disclosure-box">
            <label>Content concern (independent of relationship validity)<Textarea value={draft.contentConcern} disabled={!mutable} maxLength={4000} onChange={e => ctx.updateDraft({ contentConcern: e.target.value })} /></label>
            <label>Follow-up work<Select value={draft.followUpKind} disabled={!mutable} onChange={e => ctx.updateDraft({ followUpKind: e.target.value })}><option value="none">None</option><option value="documentation_update">Documentation update</option><option value="code_update">Code update</option></Select></label>
            {draft.followUpKind !== 'none' && <label>Work description<Textarea value={draft.followUpNote} disabled={!mutable} required onChange={e => ctx.updateDraft({ followUpNote: e.target.value })} /></label>}
          </Disclosure>
          <div className="service-toolbar"><Button variant="unstyled" type="submit" className="btn btn--accent" disabled={!mutable || !decisions.length}>Save judgment</Button>{otherOpenCount > 0 && <Button variant="secondary" type="button" disabled={!mutable || !decisions.length} onClick={() => ctx.saveJudgment(true)}>Save &amp; next open</Button>}</div>
          <small className="service-draft-hint">Drafts are kept in this browser under your account and exact context.</small>
        </form>
        <Disclosure trigger="Follow-up & judgment actions" variant="card" className="service-disclosure-box">
          <h3>Independent follow-up</h3>
          <label className="journey-form">Verification or work note<Textarea value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="service-toolbar"><Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('open_follow_up', { workKind: 'documentation_update', note, relatedJudgmentEventId: null })}>Open documentation follow-up</Button>
          {d.projection.effectiveJudgmentEventId && <Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('reverse_judgment', { eventId: d.projection.effectiveJudgmentEventId, reason: note })}>Append reversal of effective judgment</Button>}</div>
          {d.followUps.map(w => <div className="card card--p-sm service-followup-item" key={w.id}><div className="service-followup-item__head"><strong>{w.kind.replaceAll('_', ' ')}</strong><span className="service-breakdown-pill">{w.status}</span></div><small className="service-id">{w.id}</small>{w.status === 'open' && <Button variant="unstyled" className="btn btn--secondary" disabled={!mutable || !note.trim()} onClick={() => command('resolve_follow_up', { followUpId: w.id, verificationNote: note })}>Resolve with verification note</Button>}</div>)}
        </Disclosure>
        {!mutable && <p className="inline-notice">This view is read-only. Current reviewer access and a fresh snapshot are required to write.</p>}
        {['candidate', 'stale'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} correction />}
        {['rejected', 'retired'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} successor />}
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
      <TabsContent className="service-tab-panel" value="history"><p className="service-method">History is retained at this snapshot’s sequence boundary.</p>{d.history.items.map(e => <div className="card card--p-sm service-history-card" key={e.id}><div className="service-history-card__head"><strong>{e.type.replaceAll('_', ' ')}</strong><div className="service-history-card__badges">{e.payload?.decision && <span className="service-decision-pill">{e.payload.decision}</span>}<span className="service-seq-badge">seq {e.sequence}</span></div></div><p className="service-history-reason">{reasonLabel(e.reason)}</p><small className="service-history-meta">{e.recordedAt} · {e.actorId} · sequence {e.sequence}</small><Disclosure trigger="Event details" variant="subtle"><pre className="service-json">{JSON.stringify(e, null, 2)}</pre></Disclosure></div>)}{!d.history.items.length && <p className="service-empty-note">No review events at this snapshot.</p>}{d.history.nextCursor && <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={ctx.loadMoreHistory}>Load earlier history entries</Button>}</TabsContent>
    </Tabs></div>}
  </aside>;
}

function Files({ ctx }) {
  const [selected, setSelected] = useState(() => ctx.workspace.artifacts.find(a => a.artifactId === ctx.state.sourceArtifactId) || ctx.workspace.artifacts[0] || null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  useEffect(() => {
    if (!selected?.versionId) return;
    const abort = new AbortController();
    ctx.api.version(ctx.selection.repositoryId, selected.versionId, abort.signal).then(data => setSelected(s => s?.versionId === data.id ? { ...s, data } : s)).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [selected?.versionId, ctx.selection.repositoryId, ctx.api]);
  const filteredArtifacts = ctx.workspace.artifacts.filter(a => {
    const matchesSearch = `${a.path} ${a.identity?.title || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesKind = kindFilter === 'all' || a.kind === kindFilter;
    return matchesSearch && matchesKind;
  });
  const connected = selected ? ctx.rows.filter(r => r.assertion.source.artifactId === selected.artifactId || r.assertion.target.artifactId === selected.artifactId) : [];
  return <section className="service-files">
    <div className="service-filters">
      <label className="service-search-field">Search captured paths<Input type="search" placeholder="Find a file or authored record in this snapshot…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="service-validity-field">Artifact kind<Select aria-label="Filter by artifact kind" value={kindFilter} onChange={e => setKindFilter(e.target.value)}>{['all', 'code', 'document', 'requirement', 'decision'].map(k => <option key={k} value={k}>{k === 'all' ? 'All kinds' : ARTIFACT_KIND_LABELS[k]}</option>)}</Select></label>
      <span className="service-result-count">{filteredArtifacts.length} of {ctx.workspace.artifacts.length} artifacts</span>
    </div>
    <div className="service-file-grid">
      <div className="service-file-list">
        <div className="service-list-heading"><span>Repository files</span><span>{filteredArtifacts.length}</span></div>
        {filteredArtifacts.map(a => <Button variant="unstyled" className={`service-row service-file-row ${selected?.versionId === a.versionId ? 'is-selected' : ''}`} key={a.versionId} onClick={() => { setError(''); setSelected(current => current?.versionId === a.versionId ? current : a); }}>
          <ArtifactKindIcon kind={a.kind} size={15} />
          <span><strong>{a.identity.title || a.path.split('/').at(-1)}</strong><small title={a.path}>{a.path}</small></span>
          <span className="service-kind-badge">{a.kind}</span>
        </Button>)}
        {!filteredArtifacts.length && <p className="service-padding service-empty-note">No artifacts match this filter.</p>}
      </div>
      <div className="service-file-reader">
        {error && <p className="inline-notice form-error" role="alert">{error}</p>}
        {selected?.data ? <>
          <header className="service-file-header-card">
            <div>
              <div className="service-file-header-card__title">
                <span className="service-kind-badge">{ARTIFACT_KIND_LABELS[selected.kind] || selected.kind}</span>
                <strong>{selected.data.identity.title || selected.path}</strong>
              </div>
              <small className="service-id">{selected.path} · SHA-256 {selected.data.contentDigest.value.slice(0, 12)}</small>
            </div>
            <div className="service-file-header-actions">
              <span className="service-breakdown-pill">{connected.length} connected {connected.length === 1 ? 'link' : 'links'}</span>
              {selected.data.identity.kind === 'record' && <RecordRevision ctx={ctx} record={selected.data} />}
            </div>
          </header>
          <Source source={selected.data} />
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
        </> : <div className="service-reader-empty"><FileCode2 size={28} /><h2>{selected ? 'Loading captured source…' : 'Read the exact source.'}</h2><p>Select a file to inspect its captured content and revision identity.</p></div>}
      </div>
    </div>
  </section>;
}

function RecordDialog({ ctx }) {
  const key = JSON.stringify(['record', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId]);
  const form = ctx.formDrafts[key] || { title: '', content: '', kind: 'decision', reason: '' };
  const { title, content, kind, reason } = form;
  const update = patch => ctx.saveFormDraft(key, { ...form, ...patch });
  const setTitle = title => update({ title }); const setContent = content => update({ content }); const setKind = kind => update({ kind }); const setReason = reason => update({ reason });
  return <Dialog open onOpenChange={open => !open && ctx.closeModal()}><DialogContent className="service-dialog" padded={false} showClose={false} aria-labelledby="record-title"><Button variant="unstyled" className="btn service-dialog-close" onClick={ctx.closeModal} aria-label="Close record form"><X size={18} /></Button><DialogTitle id="record-title">Record intent</DialogTitle><p>Save an authored record. This does not confirm a relationship.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); const saved = await ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, 'capture_record', { kind, title, content, sourceReference: null, sourceAbsenceReason: reason })); if (saved) { ctx.saveFormDraft(key, { title: '', content: '', kind: 'decision', reason: '' }); ctx.closeModal(); } }}>
    <label>Kind<Select value={kind} onChange={e => setKind(e.target.value)}><option value="decision">Decision</option><option value="requirement">Requirement</option></Select></label><label>Title<Input value={title} required maxLength={200} onChange={e => setTitle(e.target.value)} /></label><label>Content<Textarea required value={content} maxLength={65536} onChange={e => setContent(e.target.value)} /></label><label>Why is no source reference supplied?<Textarea required value={reason} maxLength={4000} onChange={e => setReason(e.target.value)} /></label><Button variant="unstyled" type="submit" className="btn btn--accent" disabled={!ctx.canWrite || ctx.busy}>Save record</Button></form>{ctx.error && <p className="form-error" role="alert">{ctx.error}</p>}{ctx.notice && <p role="status">{ctx.notice}</p>}</DialogContent></Dialog>;
}

function SnapshotDialog({ ctx, open, onOpenChange }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="service-dialog" padded={false} showClose={false} aria-labelledby="snapshot-details-title" aria-describedby="snapshot-details-desc">
      <Button variant="unstyled" className="btn service-dialog-close" onClick={() => onOpenChange(false)} aria-label="Close snapshot details"><X size={18} /></Button>
      <DialogTitle id="snapshot-details-title">Revision &amp; snapshot details</DialogTitle>
      <DialogDescription id="snapshot-details-desc">Inspect the exact commit selection or switch to a retained historical snapshot.</DialogDescription>
      <div className="journey-form">
        {ctx.selection && <p className="service-id">{ctx.selection.baseRevision ? 'Revision comparison' : 'Initial review'} · {ctx.selection.targetRevision.commitId} · snapshot {ctx.workspace?.snapshot.snapshotVersion ?? 'loading'}</p>}
        <label>Retained snapshot<Select aria-label="Retained snapshot" value={ctx.workspace.snapshot.id} disabled={ctx.busy} onChange={async e => { await ctx.openSnapshot(e.target.value); onOpenChange(false); }}>{ctx.retainedSnapshots.map(s => <option value={s.snapshotId} key={s.snapshotId}>Version {s.snapshotVersion} · {s.mode}</option>)}{!ctx.retainedSnapshots.some(s => s.snapshotId === ctx.workspace.snapshot.id) && <option value={ctx.workspace.snapshot.id}>Version {ctx.workspace.snapshot.snapshotVersion} · {ctx.workspace.mode}</option>}</Select></label>
      </div>
    </DialogContent>
  </Dialog>;
}

function CompareDialog({ ctx, open, onOpenChange }) {
  const revisions = ctx.descriptor?.repositories.find(r => r.id === ctx.selection?.repositoryId)?.inputs.find(i => i.id === ctx.selection?.inventoryId)?.revisions || [];
  const [base, setBase] = useState(ctx.selection.baseRevision ? 'current' : revisions[0]?.commitId || '');
  const [target, setTarget] = useState(ctx.selection.targetRevision.commitId);
  const choices = ctx.workspace.progress?.capturedChoices || [];
  const revisionCaptured = commit => choices.some(choice => choice.selection.targetRevision.commitId === commit);
  const baseCaptured = base === 'current'
    ? ctx.workspace.snapshot.coverage.some(c => c.function === 'ingestion' && c.status === 'complete')
    : revisionCaptured(base);
  const comparisonReady = baseCaptured && revisionCaptured(target);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="service-dialog" padded={false} showClose={false} aria-labelledby="compare-revisions-title" aria-describedby="compare-revisions-desc">
      <Button variant="unstyled" className="btn service-dialog-close" onClick={() => onOpenChange(false)} aria-label="Close comparison dialog"><X size={18} /></Button>
      <DialogTitle id="compare-revisions-title">Compare revisions</DialogTitle>
      <DialogDescription id="compare-revisions-desc">Native Git compares captured file bytes. The selected baseline retains its decisions; incoming evidence needs its own review.</DialogDescription>
      <form className="journey-form" onSubmit={async e => {
        e.preventDefault();
        try {
          const initial = { ...ctx.selection, comparisonId: undefined, baseRevision: null };
          const before = base === 'current' ? { snapshot: ctx.workspace.snapshot } : await ctx.api.query(ctx.selection.repositoryId, 'select_context', { ...initial, targetRevision: { objectAlgorithm: 'sha1', commitId: base } });
          const targetSelection = { ...initial, targetRevision: { objectAlgorithm: 'sha1', commitId: target } };
          const after = await ctx.api.query(ctx.selection.repositoryId, 'select_context', targetSelection);
          const res = await ctx.submit(contextEnvelope(targetSelection, { viewId: after.repositoryViewId }, 'compare_revisions', { baseSnapshotId: before.snapshot.id, targetSnapshotId: after.snapshot.id }));
          if (res) onOpenChange(false);
        } catch (error) { ctx.report(error); }
      }}>
        <label>Baseline<Select value={base} onChange={e => setBase(e.target.value)}><option value="current">Current snapshot · {ctx.selection.targetRevision.commitId.slice(0, 7)}</option>{revisions.map(r => <option key={r.label} value={r.commitId}>{r.label} · {r.commitId.slice(0, 7)}</option>)}</Select></label>
        <label>Target revision<Select value={target} onChange={e => setTarget(e.target.value)}>{revisions.map(r => <option key={r.label} value={r.commitId}>{r.label} · {r.commitId.slice(0, 7)}</option>)}</Select></label>
        <Button type="submit" disabled={!ctx.canWrite || ctx.busy || !comparisonReady}>Compare and review impact</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

function WorkspaceProgress({ ctx, onOpenCompare }) {
  const progress = ctx.workspace.progress;
  if (!progress) return <section className="card card--p-sm" role="status">Progress is unavailable. Refresh to read service state.</section>;
  const labels = { sources: 'Capture or inspect sources', discovery: 'Run discovery or inspect results', review: 'Continue review', compare: 'Compare revisions', incoming: 'Review affected relationships' };
  const modules = { sources: progress.steps[0].state === 'complete' ? 'files' : 'governance', discovery: 'governance', review: 'changes', incoming: 'changes' };
  const activeAlerts = progress.operations.filter(o => !['complete', 'partial'].includes(o.status));
  return <section className="card card--p-sm service-progress" aria-label="Repository progress">
    <div className="service-progress__header">
      <div>
        <h2>Your path to revalidation</h2>
        <p>Git compares the captured revisions. Only directly affected relationships enter the incoming review queue.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onOpenCompare}><GitCompare size={14} />Compare revisions</Button>
    </div>
    <ol className="service-progress-steps">{progress.steps.map((step, index) => <li key={step.id} className={`service-progress-step ${progress.currentStep === step.id ? 'is-current' : ''} is-state-${step.state}`} aria-current={progress.currentStep === step.id ? 'step' : undefined}>
      <div className="service-progress-step__top">
        <span className="service-step-num" aria-hidden="true">{index + 1}</span>
        <span className={`service-chip service-chip--step-${step.state}`}>{step.state.replaceAll('_', ' ')}{progress.currentStep === step.id ? ' · current step' : ''}</span>
      </div>
      <strong>{step.label}</strong>
      <div className="service-progress-step__body">
        {(step.id === 'review' && progress.baseline.pending > 0 ? [] : step.blockers).filter(() => progress.currentStep === step.id || ['blocked', 'partial', 'unknown'].includes(step.state)).map((text, i) => <p key={i}>{text}</p>)}
        {step.id === 'review' && <p className="service-step-metric">{progress.counts.reviewed} reviewed · {progress.counts.pending} pending · {progress.baseline.rejected} rejected</p>}
        {step.id === 'revalidate' && progress.comparisonPublished && <p className="service-step-metric">{progress.counts.stale} stale · {progress.counts.candidate} candidate · {progress.counts.pending} pending</p>}
      </div>
      {step.action !== 'compare' && <Button variant={progress.currentStep === step.id ? 'secondary' : 'ghost'} size="sm" disabled={step.id === 'revalidate' && !progress.comparisonPublished} onClick={() => { if (step.action === 'review' && progress.comparisonPublished) ctx.changeSelection(progress.baseline.selection); ctx.switchModule(modules[step.action]); }}>{step.action === 'review' && progress.comparisonPublished ? 'Open baseline review' : labels[step.action]}</Button>}
    </li>)}</ol>
    {activeAlerts.length > 0 && <div className="service-progress-alerts">{activeAlerts.map(o => <p className="inline-notice" role="status" key={o.id}>{o.kind}: {o.status}{o.limitations.length ? ` · ${o.limitations.join(' ')}` : ''}</p>)}</div>}
    <div className="service-progress-footer">
      <p className="service-method">You can compare revisions anytime without reviewing every baseline candidate. Rejecting a candidate dismisses it without confirming support.</p>
      {ctx.workspace.mode === 'historical' && <span className="service-breakdown-pill">Retained snapshot: inspection only</span>}
    </div>
  </section>;
}

function Content({ ctx, onOpenCompare }) {
  const module = ctx.state.activeModule;
  const pendingRows = ctx.rows.filter(row => row.projection.resolution === 'open');
  if (module === 'account') {
    const repos = ctx.descriptor?.repositories || [];
    const initials = (ctx.session.displayName || ctx.session.actorId || 'U').slice(0, 2).toUpperCase();
    return <div className="service-account-layout">
      <section className="card card--p-sm service-account-card">
        <div className="service-account-card__head">
          <span className="service-account-avatar">{initials}</span>
          <div>
            <h2>{ctx.session.displayName}</h2>
            <p className="service-id">Named server account · {ctx.session.actorId}</p>
          </div>
          <Button variant="secondary" disabled={ctx.busy} onClick={ctx.signOut}><LogOut size={15} />Sign out</Button>
        </div>
        <div className="service-account-meta">
          <div><Clock size={14} /><span>Session expires <strong>{ctx.session.absoluteExpiresAt}</strong></span></div>
          <div><Shield size={14} /><span>Server-verified HTTP-only session cookie with actor-scoped browser drafts.</span></div>
        </div>
      </section>
      <section className="card card--p-sm service-account-card">
        <h3>Granted repositories ({repos.length})</h3>
        <div className="service-account-repos">
          {repos.map(repo => <div className="service-account-repo-row" key={repo.id}>
            <div>
              <strong>{repo.inputs?.[0]?.repositoryFullName || repo.name}</strong>
              <small>{repo.inputs?.[0]?.pathCount || 0} accepted paths · {repo.inputs?.[0]?.revisions?.length || 0} registered revisions</small>
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
            <p className="service-method">Switch between warm paper light mode and low-glare dark mode.</p>
          </div>
          <Button variant="secondary" onClick={ctx.toggleTheme}>{ctx.theme === 'dark' ? <><Sun size={15} />Switch to Light mode</> : <><Moon size={15} />Switch to Dark mode</>}</Button>
        </div>
      </section>
      <section className="card card--p-sm service-account-card">
        <h3>Session &amp; draft boundaries</h3>
        <p className="service-method">Your access is checked by the service on every request. Passwords and session tokens are not stored in browser drafts.</p>
      </section>
    </div>;
  }
  if (!ctx.workspace) return <section className="card card--p-sm"><h2>{ctx.busy ? 'Loading your workspace…' : 'No registered input available'}</h2><p>{ctx.busy ? 'Reading the selected repository snapshot.' : 'The local operator must register an accepted inventory and discovery profile for a repository granted to your account.'}</p></section>;
  if (module === 'files') return <Files key={`${ctx.workspace.snapshot.id}-${ctx.state.sourceArtifactId || ''}`} ctx={ctx} />;
  if (module === 'changes') return <Relationships ctx={ctx} />;
  if (module === 'explore') return <><ServiceGraph key={ctx.workspace.snapshot.id} ctx={ctx} /><Relationships heading={false} ctx={ctx} /></>;
  if (module === 'coverage') return <section className="service-coverage">
    <div className="service-coverage-overview">
      <div className="card card--p-sm"><strong>{ctx.workspace.artifacts.length}</strong><span>Captured artifacts</span></div>
      <div className="card card--p-sm"><strong>{ctx.rows.length}</strong><span>Snapshot relationships</span></div>
      <div className="card card--p-sm"><strong>{ctx.workspace.snapshot.limitations.length}</strong><span>Disclosed limits</span></div>
      <div className="card card--p-sm"><strong className="service-cap">{ctx.workspace.mode}</strong><span>Snapshot mode</span></div>
    </div>
    <div className="service-section-heading"><h2>Processing coverage</h2><p>Completion applies to the accepted inventory for each function. Unsupported functions remain explicit.</p></div>
    <div className="service-coverage-table"><div className="service-coverage-heading" aria-hidden="true"><span>Function</span><span>Status</span><span>Processed / Eligible</span></div>{ctx.workspace.snapshot.coverage.map(c => <section className="service-coverage-row" key={c.function}><div><h3>{c.function.replaceAll('_', ' ')}</h3><small>{c.excludedCount ?? 'Unknown'} excluded</small></div><span className={`service-chip service-chip--${c.status}`}>{c.status}</span><span className="service-coverage-count">{c.processedCount} / {c.eligibleCount ?? 'unknown'}</span>{!!c.limitations.length && <div className="service-coverage-disclosure"><Disclosure trigger="Scope & limitations" variant="subtle"><ul>{c.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></Disclosure></div>}</section>)}</div>
    <Limitations ctx={ctx} />
  </section>;
  if (module === 'governance') {
    const repo = ctx.descriptor.repositories.find(r => r.id === ctx.selection.repositoryId);
    const activeInput = repo?.inputs?.find(i => i.id === ctx.selection.inventoryId);
    return <div className="service-governance-layout">
      <div className="service-governance-grid">
        <section className="card card--p-sm">
          <h2>Repository access</h2>
          <div className="service-gov-meta"><span className="service-breakdown-pill">Current role: {repo?.role}</span><span className="service-breakdown-pill">{activeInput?.pathCount || 0} accepted paths</span></div>
          <p>Accounts and grants are provisioned by the operator. Browser persona switching cannot change authority.</p>
        </section>
        <section className="card card--p-sm">
          <h3>Registered input</h3>
          <p>Capture and discovery use the accepted local inventory and frozen profile. Neither action acquires or executes upstream source.</p>
          <div className="service-toolbar">{[['capture_files', 'Capture accepted files'], ['discover_candidates', 'Discover unconfirmed candidates']].map(([command, label]) => <Button variant="unstyled" className="btn btn--secondary" disabled={!ctx.canWrite || ctx.busy} key={command} onClick={() => ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, command, { targetRevision: ctx.selection.targetRevision, inventoryId: ctx.selection.inventoryId, configurationId: ctx.selection.configurationId }))}>{label}</Button>)}</div>
        </section>
      </div>
      {ctx.operation && <section className="inline-notice service-operation-notice">
        <div className="service-operation-notice__head">
          <p>Operation {ctx.operation.operationId} · {ctx.operation.status}</p>
          <Button variant="unstyled" className="btn btn--secondary" onClick={ctx.checkOperation}><RefreshCw size={13} />Check processing status</Button>
        </div>
        <Disclosure trigger="Operation details" variant="subtle" className="service-operation-details"><pre className="service-json">{JSON.stringify(ctx.operation, null, 2)}</pre></Disclosure>
      </section>}
      <Limitations ctx={ctx} />
    </div>;
  }
  if (module === 'summary') {
    const confirmedCount = ctx.rows.filter(r => r.projection.validity === 'confirmed').length;
    const reviewedCount = ctx.rows.filter(r => r.projection.resolution === 'resolved').length;
    const followUps = ctx.workspace.followUps || [];
    return <>
      <div className="service-stats service-stats--four">
        <section className="card card--p-sm"><h2>{ctx.workspace.snapshot.pendingReviewCount}</h2><p>Pending relationship reviews</p></section>
        <section className="card card--p-sm"><h2>{confirmedCount}</h2><p>Confirmed relationships</p></section>
        <section className="card card--p-sm"><h2>{reviewedCount}</h2><p>Reviewed of {ctx.rows.length} total</p></section>
        <section className="card card--p-sm"><h2>{ctx.workspace.snapshot.openFollowUpCount}</h2><p>Open follow-ups</p></section>
      </div>
      <CycleActions key={ctx.workspace.snapshot.id} ctx={ctx} />
      <section className="card card--p-sm service-followups-panel">
        <div className="service-section-heading"><h2>Follow-up work <span>{followUps.length}</span></h2><p>Corrective work remains separate from relationship validity.</p></div>
        {followUps.length > 0 ? <div className="service-followup-list">{followUps.map(w => <div className="service-followup-item" key={w.id}><div className="service-followup-item__head"><strong>{w.kind.replaceAll('_', ' ')}</strong><span className="service-breakdown-pill">{w.status}</span></div><small className="service-id">Context {w.contextId}</small><Button variant="ghost" size="sm" onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(w.contextId); }}>Inspect context <ArrowRight size={13} /></Button></div>)}</div> : <p className="service-empty-note">No follow-up tasks recorded in this snapshot.</p>}
      </section>
      <Relationships ctx={ctx} />
    </>;
  }
  const resolvedCount = ctx.rows.length - pendingRows.length;
  const pct = ctx.rows.length ? Math.round((resolvedCount / ctx.rows.length) * 100) : 0;
  const docCount = (ctx.workspace.artifacts || []).filter(a => a.kind === 'document').length;
  const codeCount = (ctx.workspace.artifacts || []).filter(a => a.kind === 'code').length;
  return <div className="service-home">
    <WorkspaceProgress ctx={ctx} onOpenCompare={onOpenCompare} />
    <section className="focus-brief service-home-brief">
      <div className="focus-brief__context"><GitBranch size={14} /><span>{ctx.state.repositories.find(r => r.id === ctx.selection.repositoryId)?.fullName || 'Repository workspace'}</span><span className="cycle-label">{ctx.workspace.mode} snapshot</span></div>
      <h2>Pick up the thread.</h2>
      <p>Continuum checks whether documentation, requirements, and decisions still match your code as commits change. Open any suggested link to see the exact lines that matched and sign off or dismiss it.</p>
      {ctx.rows.length > 0 && <div className="service-brief-progress"><div className="service-progress-track" aria-hidden="true"><div className="service-progress-fill" style={{ width: `${pct}%` }} /></div><span>{resolvedCount} of {ctx.rows.length} relationships resolved ({pct}%)</span></div>}
      <div className="focus-brief__actions"><Button onClick={() => ctx.switchModule('changes')}>Continue review <ArrowRight size={15} /></Button><Button variant="secondary" onClick={() => ctx.switchModule('files')}><FileCode2 size={15} />Read sources</Button></div>
      <div className="focus-brief__summary"><span>{docCount} docs · {codeCount} Python files</span><span>{ctx.rows.length} suggested links</span><span>{ctx.workspace.snapshot.pendingReviewCount} waiting for review</span><span>{ctx.workspace.snapshot.openFollowUpCount} open follow-ups</span></div>
    </section>
    <div className="service-home-next">
      <div className="service-section-heading"><h2>Ready for review</h2><Button variant="ghost" size="sm" onClick={() => ctx.switchModule('changes')}>View all <ArrowRight size={14} /></Button></div>
      {pendingRows.slice(0, 4).map(row => <Button variant="unstyled" className="service-home-record" key={row.id} onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(row.id); }}><ArtifactKindIcon kind={row.source?.kind} size={17} /><span><strong>{row.sourceLabel || row.sourcePath}</strong><small>{row.assertion.type} → {row.targetLabel || row.targetPath}</small></span><span className={`service-chip service-chip--${row.projection.validity}`}>{row.projection.validity}</span><ChevronRight size={14} /></Button>)}
      {!pendingRows.length && <p className="service-empty-note">No pending relationship reviews in this snapshot.</p>}
    </div>
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

export default function ServiceApp() {
  const ctx = useContinuum();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => { const handler = e => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) { ctx.closeModal(); ctx.closeCommandPalette(); ctx.closeInspector(); } if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ctx.openCommandPalette(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [ctx]);
  if (ctx.checking) return <main className="entry-page" role="status"><div className="service-checking"><InfinityIcon size={28} /><span>Checking your session…</span></div></main>;
  if (!ctx.session) return <Login ctx={ctx} />;
  return <div className="service-app"><Shell {...ctx} onSwitchRepo={ctx.handleSwitchRepo} onOpenImportModal={() => ctx.switchModule('governance')} /><div className="workspace"><div className="workspace-body"><main className="canvas service-canvas" id="main-content" tabIndex={-1}>
    <header className="workspace-topline">
      <div>
        <h1>{({ dashboard: 'Workspace', changes: 'Review relationships', summary: 'Review summary', files: 'Code explorer', explore: 'Explore context', coverage: 'Coverage', account: 'Account', governance: 'Team & governance' })[ctx.state.activeModule]}</h1>
        <p className="service-page-context"><FolderGit2 size={13} />{ctx.state.repositories.find(r => r.id === ctx.state.activeRepoId)?.fullName || 'Repository workspace'}<span>·</span><span className="service-commit-pill">{ctx.selection?.targetRevision.commitId.slice(0, 7)}</span><span className="service-live-state">{ctx.workspace?.mode || 'No snapshot'}</span></p>
      </div>
      <div className="service-topline-actions">
        {ctx.workspace && <>
          <Button variant="secondary" size="sm" onClick={() => setSnapshotOpen(true)}>Revision &amp; snapshot details</Button>
          <Button variant="secondary" size="sm" onClick={() => setCompareOpen(true)}><GitCompare size={14} />Compare revisions</Button>
        </>}
        <Button variant="secondary" size="sm" disabled={ctx.busy || !ctx.selection} onClick={ctx.refresh}><RefreshCw size={15} />Refresh</Button>
      </div>
    </header>
    {ctx.workspace?.comparison && <section className="inline-notice service-comparison-banner"><GitCompare size={16} /><div><strong>{ctx.workspace.comparison.changes.length} changed paths · {ctx.workspace.comparison.impacts.length} affected relationships</strong><Disclosure trigger="Inspect source changes" variant="subtle">{ctx.workspace.comparison.changes.map(c => <p key={c.path}>{c.kind} · <code>{c.path}</code></p>)}{ctx.workspace.comparison.limitations.map(l => <p key={l}>{l}</p>)}</Disclosure></div></section>}

    {ctx.error && <p className="inline-notice form-error" role="alert">{ctx.error}</p>}
    {ctx.notice && <p className="inline-notice service-notice-banner" role="status"><CheckCircle2 size={15} /><span>{ctx.notice}</span></p>}
    {ctx.pending && !ctx.busy && <section className="inline-notice"><p>A request is retained for account {ctx.session.displayName}. Its result has not been reconciled. Retry sends the same request ID and input.</p><Button variant="unstyled" className="btn btn--secondary" disabled={ctx.busy} onClick={ctx.retryPending}>Retry retained request</Button></section>}
    {ctx.busy && <p className="service-busy-banner" role="status">Updating workspace…</p>}
    <Content ctx={ctx} onOpenCompare={() => setCompareOpen(true)} />
  </main>{ctx.state.inspectorOpen && <Inspector key={ctx.state.selectedArtifactId} ctx={ctx} />}</div></div>
    {ctx.modalOpen && <RecordDialog ctx={ctx} />}
    {ctx.workspace && snapshotOpen && <SnapshotDialog ctx={ctx} open={snapshotOpen} onOpenChange={setSnapshotOpen} />}
    {ctx.workspace && compareOpen && <CompareDialog key={ctx.selection.targetRevision.commitId} ctx={ctx} open={compareOpen} onOpenChange={setCompareOpen} />}
    {ctx.isCommandPaletteOpen && <Dialog open onOpenChange={open => !open && ctx.closeCommandPalette()}><DialogContent className="service-dialog service-search-dialog" padded={false} showClose={false} aria-labelledby="service-search-title" aria-describedby="service-search-description"><header className="service-search-header"><Search size={19} /><div><DialogTitle id="service-search-title">Search current snapshot</DialogTitle><DialogDescription id="service-search-description">Find captured relationships in the selected repository and revision.</DialogDescription></div><Button variant="ghost" size="icon-sm" onClick={ctx.closeCommandPalette} aria-label="Close search"><X size={18} /></Button></header><div className="service-search-body"><ServiceSearch ctx={ctx} /></div></DialogContent></Dialog>}
  </div>;
}
