import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  FileText, ChevronRight, Search, ArrowLeft, Download, CheckCircle2, Network, Plus, X, Printer, FileDown,
  AlertTriangle, GitCompare, Layers, Clock
} from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import { Button, Input, Textarea, Select, Checkbox, Dialog, DialogContent, DialogTitle, DialogDescription, Disclosure } from './ui/index.js';
import SourceLinePicker from './SourceLinePicker.jsx';
import { contextEnvelope, reasonLabel } from '../data/serviceModel.js';
import { buildAuditReportMarkdown } from '../data/auditReport.js';
import { buildImpactGraphData } from '../data/impactGraph.js';
const TraceabilityFlow = lazy(() => import('./TraceabilityFlow.jsx'));
const relationKinds = { documents: ['document', 'code'], implements: ['code', 'requirement'], motivates: ['decision', 'code'] };
const relationLabels = { documents: 'Document describes code', implements: 'Code implements requirement', motivates: 'Decision motivates code' };

export function RelationshipEditor({ ctx, correction = false, successor = false }) {
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(['relationship', correction || successor ? ctx.detail?.projection.contextId : 'new', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId, ctx.selection.comparisonId || null]);
  const current = ctx.formDrafts[key] || { type: correction || successor ? ctx.detail.assertion.type : 'documents', source: correction || successor ? ctx.detail.assertion.source.artifactId : '', target: correction || successor ? ctx.detail.assertion.target.artifactId : '', reason: '', anchor: 'source', start: 1, end: 1, newAnchor: false };
  const change = patch => ctx.saveFormDraft(key, { ...current, ...patch });
  const [message, setMessage] = useState('');
  const isOpen = open || (!correction && !successor && Boolean(ctx.relationshipSeed));
  const closeDialog = () => {
    setOpen(false);
    if (!correction && !successor && ctx.relationshipSeed) ctx.setRelationshipSeed(null);
  };

  const sourceItems = ctx.workspace.artifacts.filter(a => a.kind === relationKinds[current.type][0]);
  const targetItems = ctx.workspace.artifacts.filter(a => a.kind === relationKinds[current.type][1]);
  const source = sourceItems.find(a => a.artifactId === current.source) || sourceItems[0];
  const target = targetItems.find(a => a.artifactId === current.target) || targetItems[0];
  const eligible = ctx.canWrite && !ctx.busy && ctx.workspace.mode === 'active' && (!correction || ctx.detail.mode === 'active');
  const title = correction ? 'Correct this relationship' : successor ? 'Propose an unconfirmed successor' : 'Add a relationship';
  const anchoredArtifact = current.anchor === 'source' ? source : target;

  const formContent = <form className="journey-form" onSubmit={async event => {
    event.preventDefault(); setMessage(''); if (!source || !target) return;
    const endpoints = { type: current.type, sourceArtifactId: source.artifactId, sourceVersionId: source.versionId, targetArtifactId: target.artifactId, targetVersionId: target.versionId };
    const selected = current.anchor === 'source' ? source : target;
    const input = correction ? { contextId: ctx.detail.projection.contextId, assertionRevisionId: ctx.detail.assertion.id, expectedProjectionVersion: ctx.detail.projection.projectionVersion, reason: current.reason, replacement: { ...endpoints, evidenceIds: current.newAnchor ? [] : ctx.detail.assertion.evidenceIds, ...(current.newAnchor ? {newEvidence:[{artifactVersionId:selected.versionId,locator:{kind:'lines',startLine:Number(current.start),endLine:Number(current.end)}}]} : {}) } } : { ...endpoints, targetRevision: ctx.selection.targetRevision, evidence: [{ artifactVersionId: selected.versionId, locator: { kind: 'lines', startLine: Number(current.start), endLine: Number(current.end) } }], reason: current.reason, predecessorContextId: successor ? ctx.detail.projection.contextId : null };
    const saved = await ctx.submit(contextEnvelope(ctx.selection, correction ? ctx.detail : { viewId: ctx.repositoryViewId }, correction ? 'correct_assertion' : 'capture_candidate', input), key);
    if (saved) {
      setMessage('Saved as an unconfirmed claim. A separate judgment is required.');
      if (!correction && !successor) closeDialog();
    }
  }}>
    <label>Relationship meaning<Select value={current.type} disabled={!eligible} onChange={e => change({ type: e.target.value, source: '', target: '' })}>{Object.keys(relationKinds).map(type => <option value={type} key={type}>{relationLabels[type]}</option>)}</Select></label>
    <label>Source artifact<Select value={source?.artifactId ?? ''} disabled={!eligible || !source} onChange={e => change({ source: e.target.value })}>{sourceItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
    <label>Target artifact<Select value={target?.artifactId ?? ''} disabled={!eligible || !target} onChange={e => change({ target: e.target.value })}>{targetItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
    {!source || !target ? <p className="inline-notice">Capture the required artifact kinds before adding this relationship.</p> : null}
    {correction && <label className="service-checkbox"><Checkbox checked={current.newAnchor} onChange={e => change({newAnchor:e.target.checked})} />Replace evidence with new line anchors</label>}
    {(!correction || current.newAnchor) && <>
      <label>Evidence from<Select value={current.anchor} disabled={!eligible} onChange={e => change({ anchor: e.target.value, start: 1, end: 1 })}><option value="source">Source artifact</option><option value="target">Target artifact</option></Select></label>
      <SourceLinePicker
        ctx={ctx}
        repositoryId={ctx.selection.repositoryId}
        artifact={anchoredArtifact}
        startLine={current.start}
        endLine={current.end}
        disabled={!eligible}
        defaultOpen={true}
        onChangeRange={(start, end) => change({ start, end })}
      />
    </>}
    {correction && !current.newAnchor && <p>Correction retains the displayed evidence references. Both replacement endpoints must be compatible with that exact evidence. Select Replace evidence to supply new exact line anchors.</p>}
    <label>{correction ? 'Correction reason' : 'Relationship reason'}<Textarea required maxLength={4000} value={current.reason} disabled={!eligible} onChange={e => change({ reason: e.target.value })} /></label>
    <Button type="submit" disabled={!eligible || !source || !target || !current.reason.trim()}>{correction ? 'Save correction for review' : 'Save candidate relationship'}</Button>{message && <p role="status">{message}</p>}
  </form>;

  if (correction || successor) {
    return <Disclosure trigger={title} variant="card" className="service-editor-disclosure">{formContent}</Disclosure>;
  }

  return <>
    <Button variant="secondary" size="sm" onClick={() => { setMessage(''); setOpen(true); }}><Plus size={14} />{title}</Button>
    <Dialog open={isOpen} onOpenChange={next => { if (!next) closeDialog(); else setOpen(true); }}>
      <DialogContent className="service-dialog" padded={false} showClose={false} aria-labelledby="add-relationship-title" aria-describedby="add-relationship-desc">
        <Button variant="unstyled" className="btn service-dialog-close" onClick={closeDialog} aria-label="Close relationship dialog"><X size={18} /></Button>
        <DialogTitle id="add-relationship-title">{title}</DialogTitle>
        <DialogDescription id="add-relationship-desc">Propose an explicit typed relationship anchored to captured source lines. New claims enter as unconfirmed candidates.</DialogDescription>
        {formContent}
      </DialogContent>
    </Dialog>
  </>;
}

export function RecordRevision({ ctx, record }) {
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(['revise', record.id]);
  const value = ctx.formDrafts[key] || { title: record.identity.title, content: record.content, reason: '', absence: record.identity.sourceAbsenceReason || '' };
  const change = patch => ctx.saveFormDraft(key, { ...value, ...patch });
  return <>
    <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Revise this authored record</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="service-dialog" padded={false} showClose={false} aria-labelledby="revise-record-title" aria-describedby="revise-record-desc">
        <Button variant="unstyled" className="btn service-dialog-close" onClick={() => setOpen(false)} aria-label="Close revise record dialog"><X size={18} /></Button>
        <DialogTitle id="revise-record-title">Revise this authored record</DialogTitle>
        <DialogDescription id="revise-record-desc">Saving creates a new exact record version and queues linked claims for incoming review.</DialogDescription>
        <form className="journey-form" onSubmit={async e => {
          e.preventDefault();
          const artifact = ctx.workspace.artifacts.find(a => a.versionId === record.id);
          const saved = await ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, 'revise_record', { artifactId: artifact.artifactId, expectedRecordVersion: record.identity.recordVersion, title: value.title, content: value.content, sourceReference: record.identity.sourceReference, sourceAbsenceReason: record.identity.sourceReference ? null : value.absence, reason: value.reason }), key);
          if (saved) { setOpen(false); ctx.openSource(artifact.artifactId); }
        }}><label>Title<Input required value={value.title} onChange={e => change({ title: e.target.value })} /></label><label>Content<Textarea required value={value.content} onChange={e => change({ content: e.target.value })} /></label>{!record.identity.sourceReference && <label>Why is no source reference supplied?<Textarea required value={value.absence} onChange={e => change({ absence: e.target.value })} /></label>}<label>Revision reason<Textarea required value={value.reason} onChange={e => change({ reason: e.target.value })} /></label><Button type="submit" disabled={!ctx.canWrite || ctx.busy || ctx.workspace.mode !== 'active'}>Save new record version</Button></form>
      </DialogContent>
    </Dialog>
  </>;
}

export function ServiceSearch({ ctx }) {
  const [text, setText] = useState(''); const [page, setPage] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!text.trim()) return;
    const abort = new AbortController();
    const timer = setTimeout(() => { setLoading(true); setError(''); ctx.api.query(ctx.selection.repositoryId, 'search_records', { snapshotId: ctx.workspace.snapshot.id, text: text.trim(), kinds: ['code', 'document', 'requirement', 'decision'], pageSize: 20 }, abort.signal).then(setPage).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); }); }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [text, ctx.api, ctx.selection.repositoryId, ctx.workspace.snapshot.id]);
  const items = text.trim() ? page?.items || [] : ctx.workspace.artifacts.map(a => ({ artifactId: a.artifactId, artifactVersionId: a.versionId, kind: a.kind, label: a.identity.title || a.path, matches: [] }));
  return <><label className="service-search-field">Search captured knowledge<Input type="search" placeholder="Search paths, captured text, records or rationale…" value={text} onChange={e => { setText(e.target.value); setPage(null); }} /></label><p className="service-method">Literal search in this exact snapshot. Historical snapshots retain their own scope.</p>{loading && <p role="status">Searching captured knowledge…</p>}{error && <p role="alert">{error}</p>}<div className="service-list service-relationship-list">{items.map(item => <div className="service-search-result" key={item.artifactVersionId}><Button variant="unstyled" className="service-row" onClick={() => ctx.openSource(item.artifactId)}><FileText size={16} /><span className="service-row-paths"><strong>{item.label}</strong><small>{item.kind}{item.matches[0] && ` · ${item.matches[0].excerpt}`}</small></span><ChevronRight size={14} /></Button>{item.matches.find(m => m.contextId) && <Button variant="ghost" size="sm" onClick={() => { ctx.selectArtifact(item.matches.find(m => m.contextId).contextId); ctx.closeCommandPalette(); }}>Open recorded rationale</Button>}</div>)}{text.trim() && page && !items.length && <div className="queue-empty"><Search size={24} /><strong>No matching captured records</strong><p>No match within this scope does not establish that the project has no relevant knowledge.</p></div>}</div>{page?.nextCursor && <Button variant="secondary" disabled={loading} onClick={async () => { setLoading(true); try { const next = await ctx.api.query(ctx.selection.repositoryId, 'search_records', { snapshotId: ctx.workspace.snapshot.id, text: text.trim(), kinds: ['code','document','requirement','decision'], pageSize: 20, cursor: page.nextCursor }); setPage(p => p && p.nextCursor === page.nextCursor ? ({ ...next, items: [...p.items, ...next.items] }) : p); } catch(e) { setError(e.message); } finally { setLoading(false); } }}>More results</Button>}</>;
}

export function ServiceGraph({ ctx }) {
  const [root, setRoot] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphScope, setGraphScope] = useState('all');

  useEffect(() => {
    if (!root) return;
    const abort = new AbortController();
    ctx.api.query(ctx.selection.repositoryId, 'read_graph', { snapshotId: ctx.workspace.snapshot.id, rootArtifactId: root, relationTypes: ['documents','implements','motivates'], direction: 'both', depth: 1, pageSize: 100 }, abort.signal).then(setResult).catch(e => { if(e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [root, ctx.api, ctx.selection.repositoryId, ctx.workspace.snapshot.id]);

  const impact = useMemo(
    () => buildImpactGraphData(ctx.workspace, ctx.rows),
    [ctx.workspace, ctx.rows]
  );

  const currentVersion = new Map(ctx.workspace.artifacts.map(a => [a.artifactId, a.versionId]));
  const supersededIds = new Set(ctx.rows.filter(r => r.projection.resolution === 'superseded').map(r => r.id));
  const unresolvedRows = ctx.rows.filter(r => [r.assertion.source, r.assertion.target].some(e => e.availability !== 'available' || currentVersion.get(e.artifactId) !== e.versionId));
  const allEdges = root && result
    ? result.edges
        .filter(e => !supersededIds.has(e.contextId))
        .map(e => ({
          id: e.contextId,
          from: e.sourceArtifactId,
          to: e.targetArtifactId,
          label: `${e.type} · ${e.validity}`,
          kind: e.validity,
          impacted: impact.impactedContextIds.has(e.contextId) || e.validity === 'stale',
        }))
    : ctx.rows
        .filter(r => r.projection.resolution !== 'superseded' && !unresolvedRows.includes(r))
        .map(r => ({
        id: r.id,
        from: r.assertion.source.artifactId,
        to: r.assertion.target.artifactId,
        label: `${r.assertion.type} · ${r.projection.validity}`,
        kind: r.projection.validity,
        impacted: impact.impactedContextIds.has(r.id) || r.projection.validity === 'stale',
      }));

  const allNodes = ctx.workspace.artifacts.filter(a => !root || !result || result.nodes.some(n => n.artifactId === a.artifactId) || a.artifactId === root);
  const impactOnly = !root && graphScope === 'impact' && impact.hasImpact;
  const nodes = impactOnly ? allNodes.filter(a => impact.affectedIds.has(a.artifactId)) : allNodes;
  const edges = impactOnly ? allEdges.filter(e => impact.affectedIds.has(e.from) && impact.affectedIds.has(e.to)) : allEdges;

  const rootArtifact = root ? ctx.workspace.artifacts.find(a => a.artifactId === root) : null;
  const kindCounts = ['code', 'document', 'requirement', 'decision'].map(k => ({ kind: k, count: nodes.filter(n => n.kind === k).length })).filter(x => x.count > 0);

  return <>
    <div className="service-graph-bar">
      <div className="service-graph-bar__info">
        <Network size={16} aria-hidden="true" />
        <div>
          <strong>{rootArtifact ? `1-hop: ${rootArtifact.identity.title || rootArtifact.path}` : (impactOnly ? 'Change impact subgraph' : 'Full snapshot graph')}</strong>
          <div className="service-graph-legend" aria-label="Graph legend">
            {impact.changesByArtifactId.size > 0 && (
              <Tooltip content="Artifact modified, added, revised, or removed in the comparison">
                <span className="service-legend-chip is-changed"><AlertTriangle size={11} aria-hidden="true" />Changed ({impact.changesByArtifactId.size})</span>
              </Tooltip>
            )}
            {impact.affectedIds.size > 0 && (
              <Tooltip content="Downstream or upstream artifact connected to a changed node">
                <span className="service-legend-chip is-affected"><GitCompare size={11} aria-hidden="true" />Affected ({impact.affectedIds.size})</span>
              </Tooltip>
            )}
            <Tooltip content="Automated or manual proposal awaiting human decision">
              <span className="service-legend-chip is-candidate"><Clock size={11} aria-hidden="true" />Candidate</span>
            </Tooltip>
            <Tooltip content="Confirmed relationship backed by inspected evidence">
              <span className="service-legend-chip is-confirmed"><CheckCircle2 size={11} aria-hidden="true" />Confirmed</span>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="service-graph-bar__meta">
        {!root && impact.hasImpact && (
          <div className="service-view-toggle" role="group" aria-label="Graph scope">
            <Tooltip content="Show all artifacts and links in this snapshot">
              <button type="button" className={graphScope === 'all' ? 'is-active' : ''} onClick={() => setGraphScope('all')}>
                <Layers size={12} aria-hidden="true" /> All ({allNodes.length})
              </button>
            </Tooltip>
            <Tooltip content="Isolate changed artifacts and impacted neighbors">
              <button type="button" className={graphScope === 'impact' ? 'is-active' : ''} onClick={() => setGraphScope('impact')}>
                <AlertTriangle size={12} aria-hidden="true" /> Affected ({impact.affectedIds.size})
              </button>
            </Tooltip>
          </div>
        )}
        {kindCounts.map(({ kind, count }) => <span className="service-breakdown-pill" key={kind}>{count} {kind}</span>)}
        <span className="service-breakdown-pill">{edges.length} {edges.length === 1 ? 'link' : 'links'}</span>
        {root && <Button variant="secondary" size="sm" onClick={() => { setRoot(null); setResult(null); setError(''); }}><ArrowLeft size={13} />Show full snapshot</Button>}
      </div>
    </div>
    {error && <p className="inline-notice form-error" role="alert">{error}</p>}
    <div className="service-graph"><Suspense fallback={<div className="service-graph-loading" role="status">Loading graph layout…</div>}><TraceabilityFlow compact rawNodes={nodes.map(impact.enrichNode)} rawEdges={edges} onSelectNode={id => { if (id !== root) { setError(''); setResult(null); setRoot(id); } }} onSelectEdge={id => ctx.selectArtifact(id)} selectedArtifactId={root} theme={ctx.theme} /></Suspense></div>
    {result?.nextCursor && <div className="service-toolbar"><Button variant="secondary" disabled={loading} onClick={async () => {
      const cursor = result.nextCursor; setLoading(true); setError('');
      try {
        const next = await ctx.api.query(ctx.selection.repositoryId, 'read_graph', {snapshotId:ctx.workspace.snapshot.id, rootArtifactId:root, relationTypes:['documents','implements','motivates'], direction:'both', depth:1, pageSize:100, cursor});
        setResult(previous => previous?.nextCursor === cursor ? {...next, nodes:[...new Map([...previous.nodes,...next.nodes].map(node=>[node.artifactId,node])).values()], edges:[...previous.edges,...next.edges], unresolved:[...previous.unresolved,...next.unresolved]} : previous);
      } catch(e) {setError(e.message);} finally {setLoading(false);}
    }}>More neighbors</Button></div>}
    {(!root && unresolvedRows.length > 0 || (result?.unresolved?.length > 0)) && <div className="service-toolbar">{!root && unresolvedRows.map(row => <Button variant="secondary" size="sm" key={row.id} onClick={() => ctx.selectArtifact(row.id)}>Inspect unresolved or earlier-version relationship</Button>)}{result?.unresolved?.map(item => <Button variant="secondary" size="sm" key={item.contextId} onClick={() => ctx.selectArtifact(item.contextId)}>Inspect unresolved endpoint context</Button>)}</div>}
  </>;
}

function AuditReportDialog({ ctx, open, onOpenChange }) {
  const ws = ctx.workspace;
  const rows = ctx.rows || [];
  const snap = ws.snapshot;
  const repo = ctx.state?.repositories?.find(r => r.id === ctx.selection?.repositoryId);
  const repoName = repo?.fullName || snap.selection?.repositoryId || 'Repository';
  const commit = snap.selection?.targetRevision?.commitId || '';

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="service-dialog service-report-dialog" padded={false} showClose={false} aria-labelledby="audit-report-title" aria-describedby="audit-report-desc">
      <div className="service-report-toolbar no-print">
        <div>
          <DialogTitle id="audit-report-title">Continuity Audit Report</DialogTitle>
          <DialogDescription id="audit-report-desc">Human-readable summary compiled from the verified snapshot and retained rationales.</DialogDescription>
        </div>
        <div className="service-report-toolbar__actions">
          <Button variant="default" size="sm" onClick={() => window.print()}><Printer size={14} />Print / Save PDF</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="Close audit report"><X size={18} /></Button>
        </div>
      </div>
      <article className="service-print-report">
        <header className="service-print-report__head">
          <h2>Software Knowledge Continuity Audit Report</h2>
          <p><strong>{repoName}</strong> · Revision <code>{commit.slice(0, 7)}</code> · Snapshot v{snap.snapshotVersion} ({ws.mode})</p>
          <p className="service-method">Completion: {ws.completion ? `Completed at ${ws.completion.recordedAt} by ${ws.completion.actorId}` : 'In progress (review snapshot not yet completed)'}</p>
        </header>
        <section className="service-print-section">
          <h3>Review summary</h3>
          <div className="service-print-grid">
            <div><strong>{ws.artifacts?.length || 0}</strong><span>Artifacts</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'confirmed').length}</strong><span>Confirmed</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'rejected').length}</strong><span>Rejected</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'stale').length}</strong><span>Stale</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'candidate').length}</strong><span>Candidate</span></div>
            <div><strong>{snap.openFollowUpCount ?? 0}</strong><span>Open follow-ups</span></div>
          </div>
        </section>
        {ws.comparison && <section className="service-print-section">
          <h3>Revision comparison</h3>
          <p className="service-method">Compared baseline <code>{ws.comparison.baseRevision?.commitId?.slice(0, 7)}</code> → target <code>{ws.comparison.targetRevision?.commitId?.slice(0, 7)}</code> · {ws.comparison.changes.length} changed paths · {ws.comparison.impacts.length} impacted links</p>
          <ul className="service-technical-list">{ws.comparison.changes.map(c => <li key={c.path}><code>{c.path}</code> ({c.kind})</li>)}</ul>
        </section>}
        <section className="service-print-section">
          <h3>Tracked relationships ({rows.length})</h3>
          <table className="service-report-table">
            <thead><tr><th>Relationship</th><th>Type</th><th>Status</th><th>Evidence</th><th>Rationale / Note</th></tr></thead>
            <tbody>
              {rows.map(r => <tr key={r.id}>
                <td><strong>{r.sourceLabel || r.sourcePath}</strong><br /><small>{r.targetLabel || r.targetPath}</small></td>
                <td>{r.assertion.type}</td>
                <td><span className={`service-chip service-chip--${r.projection.validity}`}>{r.projection.validity}</span></td>
                <td>{r.assertion.evidenceIds?.length || 0}</td>
                <td>{r.priorDecision?.reason ? reasonLabel(r.priorDecision.reason) : (r.projection.resolution === 'resolved' ? 'Resolved' : 'Pending human review')}</td>
              </tr>)}
            </tbody>
          </table>
        </section>
        <section className="service-print-section">
          <h3>Disclosed coverage &amp; limitations</h3>
          <ul className="service-technical-list">
            {(snap.coverage || []).map(c => <li key={c.function}><strong>{c.function.replaceAll('_', ' ')}:</strong> {c.status} ({c.processedCount}/{c.eligibleCount ?? 'unknown'})</li>)}
          </ul>
          <ul className="service-technical-list">
            {(snap.limitations || []).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      </article>
    </DialogContent>
  </Dialog>;
}

export function CycleActions({ ctx }) {
  const [ack, setAck] = useState(false); const [exported, setExported] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [reportOpen, setReportOpen] = useState(false);
  const snapshot = ctx.workspace.snapshot;
  const completed = ctx.workspace.completion;
  const exportId = exported || (ctx.operation?.command === 'export_snapshot' && ctx.operation.repositoryId === ctx.selection.repositoryId ? ctx.operation.operationId : null);
  const downloadMarkdown = () => {
    const md = buildAuditReportMarkdown(ctx);
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `continuum-audit-${snapshot.selection.targetRevision.commitId.slice(0, 7)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={`service-cycle-actions ${completed ? 'is-complete' : ''}`}>
    <div className="service-cycle-actions__head">
      <div>
        <h2>{completed ? 'Review completion recorded' : 'Complete review & export audit report'}</h2>
        <p>{completed ? `Recorded at ${completed.recordedAt}. Pending follow-up tasks and coverage limits remain tracked separately.` : 'Sign off on this snapshot once pending links are resolved, or download a readable report at any time.'}</p>
      </div>
      {completed && <span className="service-status-pill service-status-pill--accent"><CheckCircle2 size={14} />Completed</span>}
    </div>
    {!completed && <label className="service-checkbox"><Checkbox checked={ack} onChange={e => setAck(e.target.checked)} />I acknowledge the disclosed coverage and method limitations.</label>}
    <div className="service-toolbar">
      <Button disabled={!ctx.canWrite || ctx.busy || !ack || snapshot.pendingReviewCount > 0 || !!completed || ctx.workspace.mode !== 'active'} onClick={() => ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'complete_cycle',{snapshotId:snapshot.id,acknowledgedLimitations:snapshot.limitations}))}>Record review completion</Button>
      <Button variant="secondary" onClick={downloadMarkdown}><FileDown size={14} />Download Markdown report</Button>
      <Button variant="secondary" onClick={() => setReportOpen(true)}><Printer size={14} />Print / PDF report</Button>
      <Button variant="secondary" disabled={ctx.busy} onClick={async () => { const response=await ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'export_snapshot',{snapshotId:snapshot.id,format:'json'})); if(response)setExported(response.result.operationId); }}><Download size={14} />Prepare JSON export</Button>
      {exportId && <Button variant="secondary" disabled={loading} onClick={async () => {setLoading(true);setError('');try {const result=await ctx.api.query(ctx.selection.repositoryId,'read_export',{operationId:exportId});if(result.document){const url=URL.createObjectURL(new Blob([JSON.stringify(result.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`continuum-${result.snapshotId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else setError(`Export is ${result.status}. Check again when processing completes.`);}catch(e){setError(e.message);}finally{setLoading(false);}}}>Check export &amp; download</Button>}
    </div>
    {snapshot.pendingReviewCount > 0 && !completed && <p className="service-method">Resolve all {snapshot.pendingReviewCount} pending relationship reviews before recording completion.</p>}
    {error && <p className="inline-notice" role="status">{error}</p>}
    {reportOpen && <AuditReportDialog ctx={ctx} open={reportOpen} onOpenChange={setReportOpen} />}
  </section>;
}
