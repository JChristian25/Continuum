import { useEffect, useState, lazy, Suspense } from 'react';
import { FileText, ChevronRight, Search, ArrowLeft, Download } from 'lucide-react';
import { Button, Input, Textarea, Select, Checkbox } from './ui/index.js';
import { contextEnvelope } from '../data/serviceModel.js';
const TraceabilityFlow = lazy(() => import('./TraceabilityFlow.jsx'));
const relationKinds = { documents: ['document', 'code'], implements: ['code', 'requirement'], motivates: ['decision', 'code'] };
const relationLabels = { documents: 'Document describes code', implements: 'Code implements requirement', motivates: 'Decision motivates code' };

export function RelationshipEditor({ ctx, correction = false, successor = false }) {
  const key = JSON.stringify(['relationship', correction || successor ? ctx.detail?.projection.contextId : 'new', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId, ctx.selection.comparisonId || null]);
  const current = ctx.formDrafts[key] || { type: correction || successor ? ctx.detail.assertion.type : 'documents', source: correction || successor ? ctx.detail.assertion.source.artifactId : '', target: correction || successor ? ctx.detail.assertion.target.artifactId : '', reason: '', anchor: 'source', start: 1, end: 1, newAnchor: false };
  const change = patch => ctx.saveFormDraft(key, { ...current, ...patch });
  const [message, setMessage] = useState('');
  const sourceItems = ctx.workspace.artifacts.filter(a => a.kind === relationKinds[current.type][0]);
  const targetItems = ctx.workspace.artifacts.filter(a => a.kind === relationKinds[current.type][1]);
  const source = sourceItems.find(a => a.artifactId === current.source) || sourceItems[0];
  const target = targetItems.find(a => a.artifactId === current.target) || targetItems[0];
  const eligible = ctx.canWrite && !ctx.busy && ctx.workspace.mode === 'active' && (!correction || ctx.detail.mode === 'active');
  return <details className="service-editor"><summary>{correction ? 'Correct this relationship' : successor ? 'Propose an unconfirmed successor' : 'Add a relationship'}</summary><form className="journey-form" onSubmit={async event => {
    event.preventDefault(); setMessage(''); if (!source || !target) return;
    const endpoints = { type: current.type, sourceArtifactId: source.artifactId, sourceVersionId: source.versionId, targetArtifactId: target.artifactId, targetVersionId: target.versionId };
    const selected = current.anchor === 'source' ? source : target;
    const input = correction ? { contextId: ctx.detail.projection.contextId, assertionRevisionId: ctx.detail.assertion.id, expectedProjectionVersion: ctx.detail.projection.projectionVersion, reason: current.reason, replacement: { ...endpoints, evidenceIds: current.newAnchor ? [] : ctx.detail.assertion.evidenceIds, ...(current.newAnchor ? {newEvidence:[{artifactVersionId:selected.versionId,locator:{kind:'lines',startLine:Number(current.start),endLine:Number(current.end)}}]} : {}) } } : { ...endpoints, targetRevision: ctx.selection.targetRevision, evidence: [{ artifactVersionId: selected.versionId, locator: { kind: 'lines', startLine: Number(current.start), endLine: Number(current.end) } }], reason: current.reason, predecessorContextId: successor ? ctx.detail.projection.contextId : null };
    const saved = await ctx.submit(contextEnvelope(ctx.selection, correction ? ctx.detail : { viewId: ctx.repositoryViewId }, correction ? 'correct_assertion' : 'capture_candidate', input), key);
    if (saved) setMessage('Saved as an unconfirmed claim. A separate judgment is required.');
  }}>
    <label>Relationship meaning<Select value={current.type} disabled={!eligible} onChange={e => change({ type: e.target.value, source: '', target: '' })}>{Object.keys(relationKinds).map(type => <option value={type} key={type}>{relationLabels[type]}</option>)}</Select></label>
    <label>Source artifact<Select value={source?.artifactId ?? ''} disabled={!eligible || !source} onChange={e => change({ source: e.target.value })}>{sourceItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
    <label>Target artifact<Select value={target?.artifactId ?? ''} disabled={!eligible || !target} onChange={e => change({ target: e.target.value })}>{targetItems.map(a => <option key={a.artifactId} value={a.artifactId}>{a.identity.title || a.path}</option>)}</Select></label>
    {!source || !target ? <p className="inline-notice">Capture the required artifact kinds before adding this relationship.</p> : null}
    {correction && <label className="service-checkbox"><Checkbox checked={current.newAnchor} onChange={e => change({newAnchor:e.target.checked})} />Replace evidence with new line anchors</label>}
    {(!correction || current.newAnchor) && <><label>Evidence from<Select value={current.anchor} disabled={!eligible} onChange={e => change({ anchor: e.target.value })}><option value="source">Source artifact</option><option value="target">Target artifact</option></Select></label><div className="service-evidence-range"><label>Start line<Input type="number" min="1" required value={current.start} onChange={e => change({ start: e.target.value })} /></label><label>End line<Input type="number" min={current.start} required value={current.end} onChange={e => change({ end: e.target.value })} /></label></div></>}
    {correction && !current.newAnchor && <p>Correction retains the displayed evidence references. Both replacement endpoints must be compatible with that exact evidence. Select Replace evidence to supply new exact line anchors.</p>}
    <label>{correction ? 'Correction reason' : 'Relationship reason'}<Textarea required maxLength={4000} value={current.reason} disabled={!eligible} onChange={e => change({ reason: e.target.value })} /></label>
    <Button type="submit" disabled={!eligible || !source || !target || !current.reason.trim()}>{correction ? 'Save correction for review' : 'Save candidate relationship'}</Button>{message && <p role="status">{message}</p>}
  </form></details>;
}

export function RecordRevision({ ctx, record }) {
  const key = JSON.stringify(['revise', record.id]);
  const value = ctx.formDrafts[key] || { title: record.identity.title, content: record.content, reason: '', absence: record.identity.sourceAbsenceReason || '' };
  const change = patch => ctx.saveFormDraft(key, { ...value, ...patch });
  return <details className="service-editor"><summary>Revise this authored record</summary><form className="journey-form" onSubmit={async e => {
    e.preventDefault();
    const artifact = ctx.workspace.artifacts.find(a => a.versionId === record.id);
    await ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, 'revise_record', { artifactId: artifact.artifactId, expectedRecordVersion: record.identity.recordVersion, title: value.title, content: value.content, sourceReference: record.identity.sourceReference, sourceAbsenceReason: record.identity.sourceReference ? null : value.absence, reason: value.reason }), key);
  }}><label>Title<Input required value={value.title} onChange={e => change({ title: e.target.value })} /></label><label>Content<Textarea required value={value.content} onChange={e => change({ content: e.target.value })} /></label>{!record.identity.sourceReference && <label>Why is no source reference supplied?<Textarea required value={value.absence} onChange={e => change({ absence: e.target.value })} /></label>}<label>Revision reason<Textarea required value={value.reason} onChange={e => change({ reason: e.target.value })} /></label><Button type="submit" disabled={!ctx.canWrite || ctx.busy || ctx.workspace.mode !== 'active'}>Save new record version</Button></form></details>;
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
  const [root, setRoot] = useState(null); const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!root) return;
    const abort = new AbortController();
    ctx.api.query(ctx.selection.repositoryId, 'read_graph', { snapshotId: ctx.workspace.snapshot.id, rootArtifactId: root, relationTypes: ['documents','implements','motivates'], direction: 'both', depth: 1, pageSize: 100 }, abort.signal).then(setResult).catch(e => { if(e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [root, ctx.api, ctx.selection.repositoryId, ctx.workspace.snapshot.id]);
  const currentVersion = new Map(ctx.workspace.artifacts.map(a => [a.artifactId, a.versionId]));
  const unresolvedRows = ctx.rows.filter(r => [r.assertion.source, r.assertion.target].some(e => e.availability !== 'available' || currentVersion.get(e.artifactId) !== e.versionId));
  const edges = root && result ? result.edges.map(e => ({ id:e.contextId, from:e.sourceArtifactId, to:e.targetArtifactId, label:`${e.type} · ${e.validity}`, kind:e.validity })) : ctx.rows.filter(r => !unresolvedRows.includes(r)).map(r => ({ id:r.id, from:r.assertion.source.artifactId, to:r.assertion.target.artifactId, label:`${r.assertion.type} · ${r.projection.validity}`, kind:r.projection.validity }));
  const nodes = ctx.workspace.artifacts.filter(a => !root || !result || result.nodes.some(n => n.artifactId === a.artifactId) || a.artifactId === root);
  return <><div className="service-section-heading"><p className="service-explore-note">Select an edge to inspect that exact relationship. Select a node for its typed one-hop neighborhood.</p>{root && <Button variant="ghost" size="sm" onClick={() => { setRoot(null); setResult(null); setError(''); }}><ArrowLeft size={13} />Show full snapshot</Button>}</div>{error && <p role="alert">{error}</p>}<div className="service-graph"><Suspense fallback={<p>Loading graph…</p>}><TraceabilityFlow compact rawNodes={nodes.map(a => ({ id:a.artifactId,title:a.identity.title || a.path.split('/').at(-1),sub:a.path,category:a.kind }))} rawEdges={edges} onSelectNode={id => { if (id !== root) { setError(''); setResult(null); setRoot(id); } }} onSelectEdge={id => ctx.selectArtifact(id)} selectedArtifactId={root} theme={ctx.theme} /></Suspense></div>{result?.nextCursor && <Button variant="secondary" disabled={loading} onClick={async () => {
    const cursor = result.nextCursor; setLoading(true); setError('');
    try {
      const next = await ctx.api.query(ctx.selection.repositoryId, 'read_graph', {snapshotId:ctx.workspace.snapshot.id, rootArtifactId:root, relationTypes:['documents','implements','motivates'], direction:'both', depth:1, pageSize:100, cursor});
      setResult(previous => previous?.nextCursor === cursor ? {...next, nodes:[...new Map([...previous.nodes,...next.nodes].map(node=>[node.artifactId,node])).values()], edges:[...previous.edges,...next.edges], unresolved:[...previous.unresolved,...next.unresolved]} : previous);
    } catch(e) {setError(e.message);} finally {setLoading(false);}
  }}>More neighbors</Button>}{!root && unresolvedRows.map(row => <Button variant="secondary" key={row.id} onClick={() => ctx.selectArtifact(row.id)}>Inspect unresolved or earlier-version relationship</Button>)}{result?.unresolved?.map(item => <Button variant="secondary" key={item.contextId} onClick={() => ctx.selectArtifact(item.contextId)}>Inspect unresolved endpoint context</Button>)}</>;
}

export function CycleActions({ ctx }) {
  const [ack, setAck] = useState(false); const [exported, setExported] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const snapshot = ctx.workspace.snapshot;
  const exportId = exported || (ctx.operation?.command === 'export_snapshot' && ctx.operation.repositoryId === ctx.selection.repositoryId ? ctx.operation.operationId : null);
  return <section className="service-cycle-actions"><div><h2>{ctx.workspace.completion ? 'Review completion recorded' : 'Complete this review snapshot'}</h2><p>Open follow-up work and processing limitations remain separate from review completion.</p></div><label className="service-checkbox"><Checkbox checked={ack} onChange={e => setAck(e.target.checked)} />I acknowledge the disclosed coverage and method limitations.</label><div className="service-toolbar"><Button disabled={!ctx.canWrite || ctx.busy || !ack || snapshot.pendingReviewCount > 0 || !!ctx.workspace.completion || ctx.workspace.mode !== 'active'} onClick={() => ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'complete_cycle',{snapshotId:snapshot.id,acknowledgedLimitations:snapshot.limitations}))}>Record review completion</Button><Button variant="secondary" disabled={ctx.busy} onClick={async () => { const response=await ctx.submit(contextEnvelope(ctx.selection,{viewId:ctx.repositoryViewId},'export_snapshot',{snapshotId:snapshot.id,format:'json'})); if(response)setExported(response.result.operationId); }}><Download size={14} />Prepare JSON export</Button>{exportId && <Button variant="secondary" disabled={loading} onClick={async () => {setLoading(true);try {const result=await ctx.api.query(ctx.selection.repositoryId,'read_export',{operationId:exportId});if(result.document){const url=URL.createObjectURL(new Blob([JSON.stringify(result.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`continuum-${result.snapshotId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else setError(`Export is ${result.status}. Check again when processing completes.`);}catch(e){setError(e.message);}finally{setLoading(false);}}}>Check export & download</Button>}</div>{error && <p role="status">{error}</p>}</section>;
}
