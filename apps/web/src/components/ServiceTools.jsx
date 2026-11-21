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
const relationKinds = {
  documents: [['document'], ['code']],
  depends_on: [['document', 'code'], ['code', 'document']],
  implements: [['code'], ['requirement']],
  motivates: [['decision'], ['code']],
};
const relationLabels = {
  documents: 'Document describes code (documents)',
  depends_on: 'Declares package or config dependency (depends_on)',
  implements: 'Code implements requirement (implements)',
  motivates: 'Decision motivates code (motivates)',
};

export function RelationshipEditor({ ctx, correction = false, successor = false, defaultOpen = false }) {
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(['relationship', correction || successor ? ctx.detail?.projection.contextId : 'new', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId, ctx.selection.comparisonId || null]);
  const current = ctx.formDrafts[key] || { type: correction || successor ? ctx.detail.assertion.type : 'documents', source: correction || successor ? ctx.detail.assertion.source.artifactId : '', target: correction || successor ? ctx.detail.assertion.target.artifactId : '', reason: '', anchor: 'source', start: '', end: '', newAnchor: false };
  const change = patch => ctx.saveFormDraft(key, { ...current, ...patch });
  const [message, setMessage] = useState('');
  const isOpen = open || (!correction && !successor && Boolean(ctx.relationshipSeed));
  const closeDialog = () => {
    setOpen(false);
    if (!correction && !successor && ctx.relationshipSeed) ctx.setRelationshipSeed(null);
  };

  const allowedKinds = relationKinds[current.type] || [['document'], ['code']];
  const sourceItems = ctx.workspace.artifacts.filter(a => allowedKinds[0].includes(a.kind));
  const targetItems = ctx.workspace.artifacts.filter(a => allowedKinds[1].includes(a.kind));
  const source = sourceItems.find(a => a.artifactId === current.source) || sourceItems[0];
  const target = targetItems.find(a => a.artifactId === current.target) || targetItems[0];
  const eligible = ctx.canWrite && !ctx.busy && ctx.workspace.mode === 'active' && (!correction || ctx.detail.mode === 'active');
  const title = correction ? 'Correct relationship meaning or endpoints' : successor ? 'Propose an unconfirmed successor' : 'Add a relationship';
  const anchoredArtifact = current.anchor === 'source' ? source : target;
  const needsLineSelection = !correction || current.newAnchor;
  const hasLineSelection = Number.isInteger(Number(current.start)) && Number(current.start) >= 1 && Number(current.end) >= Number(current.start);
  const canSubmit = eligible && source && target && current.reason.trim() && (!needsLineSelection || hasLineSelection);

  const formFields = <>
    <label>Relationship meaning<Select value={current.type} disabled={!eligible} onChange={e => {
      const nextType = e.target.value;
      const nextKinds = relationKinds[nextType] || [['document'], ['code']];
      const keepSource = source && nextKinds[0].includes(source.kind) ? source.artifactId : '';
      const keepTarget = target && nextKinds[1].includes(target.kind) ? target.artifactId : '';
      change({ type: nextType, source: keepSource, target: keepTarget });
    }}>{Object.keys(relationKinds).map(type => <option value={type} key={type}>{relationLabels[type]}</option>)}</Select></label>
    <div className="service-form-grid-2">
      <label>Source artifact<Select value={source?.artifactId ?? ''} disabled={!eligible || !source} onChange={e => change({ source: e.target.value, start: '', end: '' })}>{sourceItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
      <label>Target artifact<Select value={target?.artifactId ?? ''} disabled={!eligible || !target} onChange={e => change({ target: e.target.value, start: '', end: '' })}>{targetItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
    </div>
    {!source || !target ? <p className="inline-notice">Capture the required artifact kinds before adding this relationship.</p> : null}
    {correction && <label className="service-checkbox"><Checkbox checked={current.newAnchor} onChange={e => change({ newAnchor: e.target.checked, start: '', end: '' })} />Replace evidence with new line anchors</label>}
    {needsLineSelection && <>
      <label>Evidence from<Select value={current.anchor} disabled={!eligible} onChange={e => change({ anchor: e.target.value, start: '', end: '' })}><option value="source">Source artifact</option><option value="target">Target artifact</option></Select></label>
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
    <label>{correction ? 'Correction reason' : 'Relationship reason'}<Textarea required maxLength={4000} value={current.reason} disabled={!eligible} placeholder="Explain why these artifacts are connected…" onChange={e => change({ reason: e.target.value })} /></label>
    {needsLineSelection && !hasLineSelection && <p className="service-method">Pick at least one source line above before saving.</p>}
    {message && <p role="status">{message}</p>}
  </>;

  const handleFormSubmit = async event => {
    event.preventDefault(); setMessage(''); if (!canSubmit) return;
    const endpoints = { type: current.type, sourceArtifactId: source.artifactId, sourceVersionId: source.versionId, targetArtifactId: target.artifactId, targetVersionId: target.versionId };
    const selected = current.anchor === 'source' ? source : target;
    const input = correction ? { contextId: ctx.detail.projection.contextId, assertionRevisionId: ctx.detail.assertion.id, expectedProjectionVersion: ctx.detail.projection.projectionVersion, reason: current.reason, replacement: { ...endpoints, evidenceIds: current.newAnchor ? [] : ctx.detail.assertion.evidenceIds, ...(current.newAnchor ? {newEvidence:[{artifactVersionId:selected.versionId,locator:{kind:'lines',startLine:Number(current.start),endLine:Number(current.end)}}]} : {}) } } : { ...endpoints, targetRevision: ctx.selection.targetRevision, evidence: [{ artifactVersionId: selected.versionId, locator: { kind: 'lines', startLine: Number(current.start), endLine: Number(current.end) } }], reason: current.reason, predecessorContextId: successor ? ctx.detail.projection.contextId : null };
    const saved = await ctx.submit(contextEnvelope(ctx.selection, correction ? ctx.detail : { viewId: ctx.repositoryViewId }, correction ? 'correct_assertion' : 'capture_candidate', input), key);
    if (saved) {
      setMessage('Saved as an unconfirmed claim. A separate judgment is required.');
      if (!correction && !successor) closeDialog();
    }
  };

  if (correction || successor) {
    return <Disclosure trigger={title} defaultOpen={defaultOpen} variant="card" className="service-editor-disclosure">
      <form className="journey-form" onSubmit={handleFormSubmit}>
        {formFields}
        <Button type="submit" disabled={!canSubmit}>{correction ? 'Save correction for review' : 'Save candidate relationship'}</Button>
      </form>
    </Disclosure>;
  }

  return <>
    <Button variant="secondary" size="sm" onClick={() => { setMessage(''); setOpen(true); }}><Plus size={14} />{title}</Button>
    <Dialog open={isOpen} onOpenChange={next => { if (!next) closeDialog(); else setOpen(true); }}>
      <DialogContent className="service-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="add-relationship-title" aria-describedby="add-relationship-desc">
        <div className="service-dialog-head">
          <div>
            <DialogTitle id="add-relationship-title">{title}</DialogTitle>
            <DialogDescription id="add-relationship-desc">Propose an explicit typed relationship anchored to captured source lines. New claims enter as unconfirmed candidates.</DialogDescription>
          </div>
          <Button variant="unstyled" className="btn service-dialog-close" onClick={closeDialog} aria-label="Close relationship dialog"><X size={18} /></Button>
        </div>
        <form className="service-dialog-form" onSubmit={handleFormSubmit}>
          <div className="service-dialog-body journey-form">
            {formFields}
          </div>
          <div className="service-dialog-footer">
            <Button type="submit" disabled={!canSubmit}>Save candidate relationship</Button>
            <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
          </div>
        </form>
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
      <DialogContent className="service-dialog service-dialog--sticky" padded={false} showClose={false} aria-labelledby="revise-record-title" aria-describedby="revise-record-desc">
        <div className="service-dialog-head">
          <div>
            <DialogTitle id="revise-record-title">Revise this authored record</DialogTitle>
            <DialogDescription id="revise-record-desc">Saving creates a new exact record version and queues linked claims for incoming review.</DialogDescription>
          </div>
          <Button variant="unstyled" className="btn service-dialog-close" onClick={() => setOpen(false)} aria-label="Close revise record dialog"><X size={18} /></Button>
        </div>
        <form className="service-dialog-form" onSubmit={async e => {
          e.preventDefault();
          const artifact = ctx.workspace.artifacts.find(a => a.versionId === record.id);
          const saved = await ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, 'revise_record', { artifactId: artifact.artifactId, expectedRecordVersion: record.identity.recordVersion, title: value.title, content: value.content, sourceReference: record.identity.sourceReference, sourceAbsenceReason: record.identity.sourceReference ? null : value.absence, reason: value.reason }), key);
          if (saved) { setOpen(false); ctx.openSource(artifact.artifactId); }
        }}>
          <div className="service-dialog-body journey-form">
            <label>Title<Input required value={value.title} onChange={e => change({ title: e.target.value })} /></label>
            <label>Content<Textarea required rows={4} value={value.content} onChange={e => change({ content: e.target.value })} /></label>
            {!record.identity.sourceReference && <label>Why is no source reference supplied?<Textarea required rows={2} value={value.absence} onChange={e => change({ absence: e.target.value })} /></label>}
            <label>Revision reason<Textarea required rows={2} value={value.reason} placeholder="Explain why this record is being revised…" onChange={e => change({ reason: e.target.value })} /></label>
          </div>
          <div className="service-dialog-footer">
            <Button type="submit" disabled={!ctx.canWrite || ctx.busy || ctx.workspace.mode !== 'active'}>Save new record version</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
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
  const isLargeRepo = (ctx.workspace?.artifacts?.length || 0) > 25 && (ctx.rows?.length || 0) > 35;
  const [graphScope, setGraphScope] = useState(() => (isLargeRepo ? 'top' : 'all'));

  useEffect(() => {
    if (!root) return;
    const abort = new AbortController();
    ctx.api.query(ctx.selection.repositoryId, 'read_graph', { snapshotId: ctx.workspace.snapshot.id, rootArtifactId: root, relationTypes: ['documents', 'depends_on', 'implements', 'motivates'], direction: 'both', depth: 1, pageSize: 100 }, abort.signal).then(setResult).catch(e => { if(e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [root, ctx.api, ctx.selection.repositoryId, ctx.workspace.snapshot.id]);

  const impact = useMemo(
    () => buildImpactGraphData(ctx.workspace, ctx.rows),
    [ctx.workspace, ctx.rows]
  );

  const currentVersion = new Map(ctx.workspace.artifacts.map(a => [a.artifactId, a.versionId]));
  const supersededIds = new Set(ctx.rows.filter(r => r.projection.resolution === 'superseded').map(r => r.id));
  const unresolvedRows = ctx.rows.filter(r => [r.assertion.source, r.assertion.target].some(e => (e.availability !== undefined ? e.availability !== 'available' : false) || (e.versionId !== undefined ? currentVersion.get(e.artifactId) !== e.versionId : false)));
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
          score: 100,
        }))
    : ctx.rows
        .filter(r => r.projection.resolution !== 'superseded' && !unresolvedRows.includes(r))
        .map(r => {
          const sm = r.signalMeta || {};
          const score = (r.projection.validity === 'stale' ? 500 : 0)
            + (r.projection.validity === 'confirmed' ? 400 : 0)
            + (sm.hasExplicitPath ? 200 : 0)
            + (sm.stemOverlap ? 80 : 0)
            + ((sm.rareTokenCount || 0) * 15)
            + (sm.uniqueTokenCount || 0);
          return {
            id: r.id,
            from: r.assertion.source.artifactId,
            to: r.assertion.target.artifactId,
            label: `${r.assertion.type} · ${r.projection.validity}`,
            kind: r.projection.validity,
            impacted: impact.impactedContextIds.has(r.id) || r.projection.validity === 'stale',
            score,
          };
        });

  const degreeByArtifact = new Map();
  for (const e of allEdges) {
    degreeByArtifact.set(e.from, (degreeByArtifact.get(e.from) || 0) + 1);
    degreeByArtifact.set(e.to, (degreeByArtifact.get(e.to) || 0) + 1);
  }

  const rawAllNodes = ctx.workspace.artifacts.filter(
    a => !root || !result || result.nodes.some(n => n.artifactId === a.artifactId) || a.artifactId === root
  );
  // In large multi-hundred-file repositories, exclude isolated 0-link files from the relationship canvas
  const allNodes = (!root && ctx.workspace.artifacts.length > 25 && allEdges.length > 0)
    ? rawAllNodes.filter(a => degreeByArtifact.has(a.artifactId) || impact.affectedIds.has(a.artifactId) || ['requirement', 'decision'].includes(a.kind))
    : rawAllNodes;

  const topEdges = allEdges.length <= 28
    ? allEdges
    : [...allEdges].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 28);

  const topNodeIds = new Set();
  for (const e of topEdges) {
    topNodeIds.add(e.from);
    topNodeIds.add(e.to);
  }

  const impactOnly = !root && graphScope === 'impact' && impact.hasImpact;
  const topOnly = !root && graphScope === 'top' && isLargeRepo && !impactOnly;
  const edges = impactOnly
    ? allEdges.filter(e => impact.affectedIds.has(e.from) && impact.affectedIds.has(e.to))
    : topOnly
      ? topEdges
      : allEdges;
  const nodes = impactOnly
    ? allNodes.filter(a => impact.affectedIds.has(a.artifactId))
    : topOnly
      ? allNodes.filter(a => topNodeIds.has(a.artifactId))
      : allNodes;

  const focusOptions = [...ctx.workspace.artifacts].sort((a, b) => {
    const da = degreeByArtifact.get(a.artifactId) || 0;
    const db = degreeByArtifact.get(b.artifactId) || 0;
    if (db !== da) return db - da;
    return (a.path || '').localeCompare(b.path || '');
  });

  const rootArtifact = root ? ctx.workspace.artifacts.find(a => a.artifactId === root) : null;
  const kindCounts = ['code', 'document', 'requirement', 'decision'].map(k => ({ kind: k, count: nodes.filter(n => n.kind === k).length })).filter(x => x.count > 0);

  return <>
    <div className="service-graph-bar">
      <div className="service-graph-bar__info">
        <Network size={16} aria-hidden="true" />
        <div>
          <strong>{rootArtifact ? `1-hop neighborhood: ${rootArtifact.identity.title || rootArtifact.path}` : (impactOnly ? 'Change impact subgraph' : topOnly ? `High-signal relationship subgraph (${nodes.length} nodes)` : 'Snapshot relationship graph')}</strong>
          <p className="service-explore-note">
            {rootArtifact
              ? 'Showing direct connections. Click any connected node to re-center, or click an edge to inspect evidence.'
              : 'Select any node on the canvas or pick an artifact to focus on its 1-hop neighborhood.'}
          </p>
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
        <Select
          aria-label="Focus artifact"
          value={root || '__all__'}
          onChange={e => {
            const val = e.target.value;
            setError('');
            setResult(null);
            setRoot(val === '__all__' ? null : val);
          }}
          className="service-graph-focus-select"
        >
          <option value="__all__">Full snapshot overview ({allNodes.length})</option>
          {focusOptions.map(a => {
            const deg = degreeByArtifact.get(a.artifactId) || 0;
            return (
              <option key={a.artifactId} value={a.artifactId}>
                1-hop: {a.identity?.title || a.path}{deg > 0 ? ` (${deg} link${deg === 1 ? '' : 's'})` : ''}
              </option>
            );
          })}
        </Select>
        {!root && (isLargeRepo || impact.hasImpact) && (
          <div className="service-view-toggle" role="group" aria-label="Graph scope">
            {isLargeRepo && (
              <Tooltip content="Show the highest-signal connected relationships for readable overview">
                <button type="button" className={graphScope === 'top' ? 'is-active' : ''} onClick={() => setGraphScope('top')}>
                  Top ({topNodeIds.size})
                </button>
              </Tooltip>
            )}
            <Tooltip content="Show all connected artifacts and links in this snapshot">
              <button type="button" className={graphScope === 'all' ? 'is-active' : ''} onClick={() => setGraphScope('all')}>
                <Layers size={12} aria-hidden="true" /> All ({allNodes.length})
              </button>
            </Tooltip>
            {impact.hasImpact && (
              <Tooltip content="Isolate changed artifacts and impacted neighbors">
                <button type="button" className={graphScope === 'impact' ? 'is-active' : ''} onClick={() => setGraphScope('impact')}>
                  <AlertTriangle size={12} aria-hidden="true" /> Affected ({impact.affectedIds.size})
                </button>
              </Tooltip>
            )}
          </div>
        )}
        {kindCounts.map(({ kind, count }) => <span className="service-breakdown-pill" key={kind}>{count} {kind}</span>)}
        <span className="service-breakdown-pill">{edges.length} {edges.length === 1 ? 'link' : 'links'}</span>
        {root && <>
          <Button variant="secondary" size="sm" onClick={() => ctx.openSource(root)}>Open source</Button>
          <Button variant="secondary" size="sm" onClick={() => { setRoot(null); setResult(null); setError(''); }}><ArrowLeft size={13} />Show full snapshot</Button>
        </>}
      </div>
    </div>
    {error && <p className="inline-notice form-error" role="alert">{error}</p>}
    <div className="service-graph">{(rootArtifact && !result && !error) ? <div className="service-graph-loading" role="status">Loading 1-hop neighborhood…</div> : <Suspense fallback={<div className="service-graph-loading" role="status">Loading graph layout…</div>}><TraceabilityFlow compact height={580} rawNodes={nodes.map(impact.enrichNode)} rawEdges={edges} onSelectNode={id => { if (id !== root) { setError(''); setResult(null); setRoot(id); } }} onSelectEdge={id => ctx.selectArtifact(id)} selectedArtifactId={root} theme={ctx.theme} /></Suspense>}</div>
    {result?.nextCursor && <div className="service-toolbar"><Button variant="secondary" disabled={loading} onClick={async () => {
      const cursor = result.nextCursor; setLoading(true); setError('');
      try {
        const next = await ctx.api.query(ctx.selection.repositoryId, 'read_graph', {snapshotId:ctx.workspace.snapshot.id, rootArtifactId:root, relationTypes:['documents','depends_on','implements','motivates'], direction:'both', depth:1, pageSize:100, cursor});
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
  const confirmedCount = rows.filter(r => r.projection.validity === 'confirmed').length;
  const unconfirmedCount = snap.unresolvedCandidateCount ?? rows.filter(r => r.projection.validity === 'candidate' && ['open', 'deferred', 'screened'].includes(r.projection.resolution)).length;

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
          <p className="service-method">Sign-off status: {ws.completion ? `${ws.completion.completionScope === 'scoped_review' ? `Scoped review recorded — ${confirmedCount} confirmed, ${unconfirmedCount} unconfirmed` : `Full validation recorded — ${confirmedCount} confirmed, 0 unconfirmed`} at ${ws.completion.recordedAt} by ${ws.completion.actorId}` : 'In progress (review snapshot not yet signed off)'}</p>
        </header>
        <section className="service-print-section">
          <h3>Review summary</h3>
          <div className="service-print-grid">
            <div><strong>{ws.artifacts?.length || 0}</strong><span>Artifacts</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'confirmed').length}</strong><span>Confirmed</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'rejected').length}</strong><span>Rejected</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'stale').length}</strong><span>Stale</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open').length}</strong><span>Open candidates</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'deferred').length}</strong><span>Deferred</span></div>
            <div><strong>{rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'screened').length}</strong><span>Screened</span></div>
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
                <td><span className={`service-chip service-chip--${r.projection.validity}`}>{r.projection.validity}</span><br /><small>{r.projection.resolution}</small></td>
                <td>{r.assertion.evidenceIds?.length || 0}</td>
                <td>{r.priorDecision?.reason
                  ? reasonLabel(r.priorDecision.reason)
                  : r.projection.resolution === 'resolved'
                    ? 'Resolved'
                    : r.projection.resolution === 'deferred'
                      ? 'Deferred candidate (unconfirmed)'
                      : r.projection.resolution === 'screened'
                        ? 'Screened out (unconfirmed)'
                        : 'Pending human review'}</td>
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
  const rows = ctx.rows || [];
  const confirmedCount = rows.filter(r => r.projection.validity === 'confirmed').length;
  const staleCount = snapshot.staleReviewCount ?? rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open').length;
  const openCandidateCount = snapshot.openCandidateCount ?? rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'open').length;
  const deferredCount = snapshot.deferredCount ?? rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'deferred').length;
  const screenedCount = snapshot.screenedCount ?? rows.filter(r => r.projection.validity === 'candidate' && r.projection.resolution === 'screened').length;
  const unresolvedCandidates = snapshot.unresolvedCandidateCount ?? (openCandidateCount + deferredCount + screenedCount);
  const isFullReady = snapshot.pendingReviewCount === 0 && unresolvedCandidates === 0;
  const isScopedReady = staleCount === 0 && !isFullReady;
  const completionScope = isFullReady ? 'full' : 'scoped';
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
        <h2>{completed ? (completed.completionScope === 'scoped_review' ? 'Scoped review recorded' : 'Full validation recorded') : 'Record review sign-off & export audit report'}</h2>
        <p>{completed
          ? (completed.completionScope === 'scoped_review'
            ? `Scoped review recorded — ${completed.confirmedCount ?? confirmedCount} confirmed, ${completed.unresolvedCandidateCount ?? unresolvedCandidates} unconfirmed (${completed.openCandidateCount ?? openCandidateCount} open, ${completed.deferredCount ?? deferredCount} deferred, ${completed.screenedCount ?? screenedCount} screened) at ${completed.recordedAt}.`
            : `Full validation recorded at ${completed.recordedAt} — ${completed.confirmedCount ?? confirmedCount} confirmed, 0 unconfirmed. Follow-up work and coverage limits remain tracked separately.`)
          : 'Sign off once change-triggered stale links are resolved (scoped review keeps unconfirmed or triaged candidates explicitly visible), or export a readable audit report anytime.'}</p>
      </div>
      {completed && <span className="service-status-pill service-status-pill--accent"><CheckCircle2 size={14} />{completed.completionScope === 'scoped_review' ? 'Scoped review recorded' : 'Full validation recorded'}</span>}
    </div>
    {!completed && isScopedReady && (
      <p className="service-scoped-note" role="note">
        Change-triggered stale reviews are at 0. Recording a scoped review logs your sign-off while preserving {unresolvedCandidates} unconfirmed suggestion{unresolvedCandidates === 1 ? '' : 's'} ({openCandidateCount} open, {deferredCount} deferred, {screenedCount} screened out) in snapshots and reports.
      </p>
    )}
    {!completed && <label className="service-checkbox"><Checkbox checked={ack} onChange={e => setAck(e.target.checked)} />I acknowledge the disclosed coverage and method limitations.</label>}
    <div className="service-toolbar">
      <Button disabled={!ctx.canWrite || ctx.busy || !ack || staleCount > 0 || !!completed || ctx.workspace.mode !== 'active'} onClick={() => ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'complete_cycle',{snapshotId:snapshot.id,acknowledgedLimitations:snapshot.limitations,scope:completionScope}))}>{isFullReady ? 'Record full validation' : 'Record scoped review'}</Button>
      <Button variant="secondary" onClick={downloadMarkdown}><FileDown size={14} />Download Markdown report</Button>
      <Button variant="secondary" onClick={() => setReportOpen(true)}><Printer size={14} />Print / PDF report</Button>
      <Button variant="secondary" disabled={ctx.busy} onClick={async () => { const response=await ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'export_snapshot',{snapshotId:snapshot.id,format:'json'})); if(response)setExported(response.result.operationId); }}><Download size={14} />Prepare JSON export</Button>
      {exportId && <Button variant="secondary" disabled={loading} onClick={async () => {setLoading(true);setError('');try {const result=await ctx.api.query(ctx.selection.repositoryId,'read_export',{operationId:exportId});if(result.document){const url=URL.createObjectURL(new Blob([JSON.stringify(result.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`continuum-${result.snapshotId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else setError(`Export is ${result.status}. Check again when processing completes.`);}catch(e){setError(e.message);}finally{setLoading(false);}}}>Check export &amp; download</Button>}
    </div>
    {staleCount > 0 && !completed && <p className="service-method">Resolve all {staleCount} change-triggered stale relationship review{staleCount === 1 ? '' : 's'} before recording completion.</p>}
    {error && <p className="inline-notice" role="status">{error}</p>}
    {reportOpen && <AuditReportDialog ctx={ctx} open={reportOpen} onOpenChange={setReportOpen} />}
  </section>;
}
