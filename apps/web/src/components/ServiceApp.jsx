import { Button, Checkbox, Input, Select, Textarea, Dialog, DialogContent, DialogTitle, DialogDescription, Tabs, TabsList, TabsTrigger, TabsContent } from './ui/index.js';
import { useEffect, useState } from 'react';
import { Infinity as InfinityIcon, ArrowRight, X, RefreshCw, Search, FileText, FileCode2, ChevronRight, GitBranch, ShieldCheck } from 'lucide-react';
import Shell from './Shell.jsx';
import { useContinuum } from '../context/ContinuumBase.js';
import { contextEnvelope, permittedDecisions, optionalReason, reasonLabel } from '../data/serviceModel.js';
import './service.css';

import { RelationshipEditor, RecordRevision, ServiceSearch, ServiceGraph, CycleActions } from './ServiceTools.jsx';

function Login({ ctx }) {
  const [login, setLogin] = useState('jc');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="entry-page"><header className="entry-brand"><InfinityIcon size={32} /><span>Continuum</span></header><div className="entry-layout">
    <section className="entry-story"><h1>Good decisions deserve<br />a little continuity.</h1><p>Follow a change. Understand its connections. Leave the next person the context they need.</p><div className="entry-example"><span>Repository context</span><p>Exact sources. Inspectable decisions.</p><div><span>Code</span><ArrowRight size={15} /><span>Evidence</span><ArrowRight size={15} /><span>Your judgment</span></div></div><p className="entry-footnote">Your account opens the repositories granted to you.</p></section>
    <section className="auth-panel"><h2>Welcome back to Continuum.</h2><p>Sign in to pick up the thread of your repository.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await ctx.signIn(login, password); } catch (err) { setError(err.message); } finally { setPassword(''); setBusy(false); } }}>
      <label>Login<Input autoComplete="username" required value={login} onChange={e => setLogin(e.target.value)} /></label>
      <label>Password<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {(error || ctx.error) && <p className="form-error" role="alert">{error || ctx.error}</p>}
      <Button variant="unstyled" type="submit" className="btn btn--accent auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></Button>
    </form><p className="auth-boundary">Accounts are provisioned by the local operator. Session access is stored in an HTTP-only cookie.</p></section>
  </div></main>;
}

function Source({ source }) {
  if (!source) return <p>Exact source is unavailable.</p>;
  const path = source.identity.path || source.identity.title || source.id;
  return <section className="code-box service-source"><div className="code-box__header"><FileCode2 size={14} /><strong title={path}>{path}</strong><span>Captured source</span></div>
    <details className="service-source-content" open><summary>Read captured source</summary><div className="code-box__body">{source.content.split('\n').map((line, i) => <div className="code-line" key={i}><span className="code-line__num">{i + 1}</span><span className="code-line__text">{line || ' '}</span></div>)}</div></details>
    <details className="service-source-identity"><summary>Exact version identity</summary><pre className="service-json">{JSON.stringify({ id: source.id, identity: source.identity, digest: source.contentDigest }, null, 2)}</pre></details>
  </section>;
}

function Relationships({ ctx, onSelect, heading = true }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = ctx.rows.filter(r => `${r.sourcePath} ${r.targetPath} ${r.sourceLabel || ''} ${r.targetLabel || ''} ${r.assertion.methodId}`.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || r.projection.validity === status));
  return <section className="service-relationships">
    {heading && <div className="service-section-heading"><h2>Connected artifacts <span>{rows.length}</span></h2><p>Candidate relationships remain unconfirmed until reviewed.</p></div>}
    {heading && <RelationshipEditor ctx={ctx} />}
    <div className="service-filters"><label className="service-search-field">Search relationships<Input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by path or discovery method…" /></label><label className="service-validity-field">Validity<Select value={status} onChange={e => setStatus(e.target.value)}>{['all', 'candidate', 'confirmed', 'rejected', 'stale', 'retired'].map(s => <option key={s}>{s}</option>)}</Select></label></div>
    <div className="service-list service-relationship-list"><div className="service-list-heading" aria-hidden="true"><span>Document → Code</span><span>Validity / Review</span></div>{rows.map(row => <Button variant="unstyled" className={`service-row ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''}`} key={row.id} onClick={() => { ctx.selectArtifact(row.id); onSelect?.(); }} disabled={ctx.busy}>
      <FileText size={17} className="service-row-icon" /><span className="service-row-paths"><strong title={row.sourcePath}>{row.sourceLabel || row.sourcePath}</strong><small title={row.targetPath}><span>{row.assertion.type}</span> → {row.targetLabel || row.targetPath}</small></span><span className="service-row-status"><span className={`service-chip service-chip--${row.projection.validity}`}>{row.projection.validity}</span><small>{row.projection.resolution}</small></span><ChevronRight size={15} className="service-row-arrow" />
    </Button>)}{!rows.length && <div className="queue-empty"><Search size={24} /><strong>No matching relationships</strong><p>Try a different path or validity filter.</p></div>}</div>
  </section>;
}

function Inspector({ ctx }) {
  const [tab, setTab] = useState('evidence');
  const d = ctx.detail;
  const draft = ctx.draft;
  const note = draft.independentNote || '';
  const setNote = independentNote => ctx.updateDraft({ independentNote });
  const mutable = ctx.canWrite && d?.mode === 'active' && !ctx.busy;
  const guarded = d ? { contextId: d.projection.contextId, assertionRevisionId: d.projection.assertionRevisionId, expectedProjectionVersion: d.projection.projectionVersion } : {};
  function command(command, input) { ctx.submit(contextEnvelope(ctx.selection, d, command, { ...guarded, ...input })); }
  return <aside className="inspector service-inspector" aria-label="Relationship inspector"><header className="inspector__header"><div><h2>Relationship context</h2><p>Evidence, judgment & history</p></div><Button variant="unstyled" className="btn btn--ghost" aria-label="Close inspector" onClick={ctx.closeInspector}><X size={18} /></Button></header>
    {!d ? <p className="service-padding" role="status">{ctx.error ? 'Context could not be loaded.' : 'Loading exact evidence…'}</p> : <div className="inspector__body">
      <div className="service-inspector-status"><span className={`service-chip service-chip--${d.projection.validity}`}>{d.projection.validity}</span><span>{d.projection.resolution} review · {d.mode} snapshot</span></div><details><summary>Version details</summary><small className="service-id">Context {d.projection.contextId}<br />Assertion revision {d.assertion.id}<br />Projection {d.projection.projectionVersion}</small></details>
      {d.returnContextId ? <Button variant="secondary" size="sm" onClick={() => ctx.selectArtifact(d.returnContextId)}>Return to incoming review</Button> : ctx.workspace?.comparison?.impacts.some(i => i.contextId === d.projection.contextId) && <Button variant="secondary" size="sm" onClick={ctx.openPriorDecision}>Inspect prior decision & evidence</Button>}
      <Tabs value={tab} onValueChange={setTab} className="service-tabs"><TabsList className="service-toolbar" aria-label="Relationship context views">{['evidence', 'review', 'history'].map(t => <TabsTrigger className={`btn ${tab === t ? 'btn--accent' : ''}`} value={t} key={t}>{t}</TabsTrigger>)}</TabsList>
      <TabsContent className="service-tab-panel" value="evidence"><p className="service-method">Suggested by <code>{d.assertion.methodId}</code>. Human review is required.</p>{d.sources.map(s => <Source key={s.id} source={s} />)}
        <details className="service-disclosure"><summary>Method limitations ({d.assertion.limitations.length})</summary><ul>{d.assertion.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
        <h3>Recorded evidence</h3>{d.evidence.map(e => <section className="card card--p-sm" key={e.id}><strong>{e.availability}</strong><p className="service-id">{e.id}</p><pre className="service-json">{JSON.stringify(e.locator)}</pre><pre className="service-excerpt">{e.excerpt ?? e.reason ?? 'No resolvable excerpt.'}</pre></section>)}
        <details><summary>Processing provenance</summary><pre className="service-json">{JSON.stringify(d.provenance, null, 2)}</pre></details></TabsContent>
      <TabsContent className="service-tab-panel" value="review"><form className="journey-form" onSubmit={e => { e.preventDefault(); ctx.saveJudgment(); }}>
        <label>Relationship judgment<Select value={draft.decision} disabled={!mutable} onChange={e => ctx.updateDraft({ decision: e.target.value })}><option value="">Choose a judgment</option>{permittedDecisions(d.projection).map(v => <option key={v}>{v}</option>)}</Select></label>
        <label>{optionalReason(d, draft.decision) ? 'Reason (optional)' : 'Reason'}<Textarea value={draft.reason} disabled={!mutable} required={!optionalReason(d, draft.decision)} maxLength={4000} onChange={e => ctx.updateDraft({ reason: e.target.value })} /></label>
        <label className="service-checkbox"><Checkbox checked={draft.inspected} disabled={!mutable} onChange={e => ctx.updateDraft({ inspected: e.target.checked })} />I inspected the exact sources and recorded evidence.</label>
        <details><summary>Content concerns & follow-up</summary><label>Content concern (independent of relationship validity)<Textarea value={draft.contentConcern} disabled={!mutable} maxLength={4000} onChange={e => ctx.updateDraft({ contentConcern: e.target.value })} /></label>
        <label>Follow-up work<Select value={draft.followUpKind} disabled={!mutable} onChange={e => ctx.updateDraft({ followUpKind: e.target.value })}><option value="none">None</option><option value="documentation_update">Documentation update</option><option value="code_update">Code update</option></Select></label>
        {draft.followUpKind !== 'none' && <label>Work description<Textarea value={draft.followUpNote} disabled={!mutable} required onChange={e => ctx.updateDraft({ followUpNote: e.target.value })} /></label>}
        </details><Button variant="unstyled" type="submit" className="btn btn--accent" disabled={!mutable || !permittedDecisions(d.projection).length}>Save judgment</Button><small>Drafts are kept in this browser under your account and exact context.</small>
      </form><details><summary>Follow-up & judgment actions</summary><h3>Independent follow-up</h3><label className="journey-form">Verification or work note<Textarea value={note} onChange={e => setNote(e.target.value)} /></label>
        <Button variant="unstyled" className="btn" disabled={!mutable || !note.trim()} onClick={() => command('open_follow_up', { workKind: 'documentation_update', note, relatedJudgmentEventId: null })}>Open documentation follow-up</Button>
        {d.followUps.map(w => <div className="card card--p-sm" key={w.id}><p>{w.kind} · {w.status}</p><small className="service-id">{w.id}</small>{w.status === 'open' && <Button variant="unstyled" className="btn" disabled={!mutable || !note.trim()} onClick={() => command('resolve_follow_up', { followUpId: w.id, verificationNote: note })}>Resolve with verification note</Button>}</div>)}
        {d.projection.effectiveJudgmentEventId && <Button variant="unstyled" className="btn" disabled={!mutable || !note.trim()} onClick={() => command('reverse_judgment', { eventId: d.projection.effectiveJudgmentEventId, reason: note })}>Append reversal of effective judgment</Button>}
        </details>{!mutable && <p className="inline-notice">This view is read-only. Current reviewer access and a fresh snapshot are required to write.</p>}
        {['candidate', 'stale'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} correction />}
        {['rejected', 'retired'].includes(d.projection.validity) && <RelationshipEditor ctx={ctx} successor />}
      </TabsContent>
      <TabsContent className="service-tab-panel" value="history"><p>History is retained at this snapshot’s sequence boundary.</p>{d.history.items.map(e => <div className="card card--p-sm" key={e.id}><strong>{e.type}</strong><p>{reasonLabel(e.reason)}</p><small>{e.recordedAt} · {e.actorId} · sequence {e.sequence}</small><details><summary>Event details</summary><pre className="service-json">{JSON.stringify(e, null, 2)}</pre></details></div>)}{!d.history.items.length && <p>No review events at this snapshot.</p>}{d.history.nextCursor && <Button variant="secondary" size="sm" disabled={ctx.busy} onClick={ctx.loadMoreHistory}>Load earlier history entries</Button>}</TabsContent>
    </Tabs></div>}
  </aside>;
}

function Files({ ctx }) {
  const [selected, setSelected] = useState(() => ctx.workspace.artifacts.find(a => a.artifactId === ctx.state.sourceArtifactId) || ctx.workspace.artifacts[0] || null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!selected?.versionId) return;
    const abort = new AbortController();
    ctx.api.version(ctx.selection.repositoryId, selected.versionId, abort.signal).then(data => setSelected(s => s?.versionId === data.id ? { ...s, data } : s)).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [selected?.versionId, ctx.selection.repositoryId, ctx.api]);
  return <section className="service-files"><div className="service-filters"><label className="service-search-field">Search captured paths<Input type="search" placeholder="Find a file in this snapshot…" value={search} onChange={e => setSearch(e.target.value)} /></label><span className="service-result-count">{ctx.workspace.artifacts.length} captured artifacts</span></div><div className="service-file-grid"><div className="service-file-list"><div className="service-list-heading">Repository files</div>{ctx.workspace.artifacts.filter(a => a.path.toLowerCase().includes(search.toLowerCase())).map(a => <Button variant="unstyled" className={`service-row service-file-row ${selected?.versionId === a.versionId ? 'is-selected' : ''}`} key={a.versionId} onClick={() => { setError(''); setSelected(current => current?.versionId === a.versionId ? current : a); }}><FileCode2 size={15} /><span><strong>{a.identity.title || a.path.split('/').at(-1)}</strong><small title={a.path}>{a.path}</small></span></Button>)}</div><div className="service-file-reader">{error && <p role="alert">{error}</p>}{selected?.data ? <><Source source={selected.data} />{selected.data.identity.kind === 'record' && <RecordRevision ctx={ctx} record={selected.data} />}</> : <div className="service-reader-empty"><FileCode2 size={28} /><h2>{selected ? 'Loading captured source…' : 'Read the exact source.'}</h2><p>Select a file to inspect its captured content and revision identity.</p></div>}</div></div></section>;
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

function CompareRevisions({ ctx }) {
  const revisions = ctx.descriptor?.repositories.find(r => r.id === ctx.selection?.repositoryId)?.inputs.find(i => i.id === ctx.selection?.inventoryId)?.revisions || [];
  const [base, setBase] = useState(ctx.selection.baseRevision ? 'current' : revisions[0]?.commitId || '');
  const [target, setTarget] = useState(ctx.selection.targetRevision.commitId);
  const choices = ctx.workspace.progress?.capturedChoices || [];
  const revisionCaptured = commit => choices.some(choice => choice.selection.targetRevision.commitId === commit);
  const baseCaptured = base === 'current'
    ? ctx.workspace.snapshot.coverage.some(c => c.function === 'ingestion' && c.status === 'complete')
    : revisionCaptured(base);
  const comparisonReady = baseCaptured && revisionCaptured(target);
  return <details id="service-comparison" className="service-context"><summary>Compare revisions</summary><form className="journey-form" onSubmit={async e => {
    e.preventDefault();
    try {
      const initial = { ...ctx.selection, comparisonId: undefined, baseRevision: null };
      const before = base === 'current' ? { snapshot: ctx.workspace.snapshot } : await ctx.api.query(ctx.selection.repositoryId, 'select_context', { ...initial, targetRevision: { objectAlgorithm: 'sha1', commitId: base } });
      const targetSelection = { ...initial, targetRevision: { objectAlgorithm: 'sha1', commitId: target } };
      const after = await ctx.api.query(ctx.selection.repositoryId, 'select_context', targetSelection);
      await ctx.submit(contextEnvelope(targetSelection, { viewId: after.repositoryViewId }, 'compare_revisions', { baseSnapshotId: before.snapshot.id, targetSnapshotId: after.snapshot.id }));
    } catch (error) { ctx.report(error); }
  }}><label>Baseline<Select value={base} onChange={e => setBase(e.target.value)}><option value="current">Current snapshot · {ctx.selection.targetRevision.commitId.slice(0, 7)}</option>{revisions.map(r => <option key={r.label} value={r.commitId}>{r.label} · {r.commitId.slice(0, 7)}</option>)}</Select></label><label>Target revision<Select value={target} onChange={e => setTarget(e.target.value)}>{revisions.map(r => <option key={r.label} value={r.commitId}>{r.label} · {r.commitId.slice(0, 7)}</option>)}</Select></label><p>Native Git compares captured file bytes. The selected baseline retains its decisions; incoming evidence needs its own review. Both inventories must already be captured.</p><Button type="submit" disabled={!ctx.canWrite || ctx.busy || !comparisonReady}>Compare and review impact</Button></form></details>;
}

function WorkspaceProgress({ ctx }) {
  const progress = ctx.workspace.progress;
  if (!progress) return <section className="card card--p-sm" role="status">Progress is unavailable. Refresh to read service state.</section>;
  const labels = { sources: 'Capture or inspect sources', discovery: 'Run discovery or inspect results', review: 'Continue review', compare: 'Compare revisions', incoming: 'Review affected relationships' };
  const modules = { sources: progress.steps[0].state === 'complete' ? 'files' : 'governance', discovery: 'governance', review: 'summary', incoming: 'changes' };
  return <section className="card card--p-sm service-progress" aria-label="Repository progress"><h2>Your path to revalidation</h2><p>Git compares the captured revisions. Only directly affected relationships enter the incoming review queue.</p><ol>{progress.steps.map(step => <li key={step.id} aria-current={progress.currentStep === step.id ? 'step' : undefined}><div><strong>{step.label}</strong><span className="service-chip">{step.state.replaceAll('_', ' ')}{progress.currentStep === step.id ? ' · current step' : ''}</span></div>{(step.id === 'review' && progress.baseline.pending > 0 ? [] : step.blockers).filter(() => progress.currentStep === step.id || ['blocked', 'partial', 'unknown'].includes(step.state)).map((text, i) => <p key={i}>{text}</p>)}{step.id === 'review' && <p>{progress.counts.reviewed} reviewed · {progress.counts.pending} pending · {progress.baseline.rejected} rejected</p>}{step.id === 'revalidate' && progress.comparisonPublished && <p>{progress.counts.stale} stale · {progress.counts.candidate} candidate · {progress.counts.pending} pending</p>}{step.action !== 'compare' && <Button variant={progress.currentStep === step.id ? 'secondary' : 'ghost'} size="sm" disabled={step.id === 'revalidate' && !progress.comparisonPublished} onClick={() => { if (step.action === 'review' && progress.comparisonPublished) ctx.changeSelection(progress.baseline.selection); ctx.switchModule(modules[step.action]); }}>{step.action === 'review' && progress.comparisonPublished ? 'Open baseline review' : labels[step.action]}</Button>}</li>)}</ol>{progress.operations.filter(o => !['complete', 'partial'].includes(o.status)).map(o => <p role="status" key={o.id}>{o.kind}: {o.status}{o.limitations.length ? ` · ${o.limitations.join(' ')}` : ''}</p>)}<p className="service-method">Rejecting a candidate resolves its review without confirming support. Unresolved work stays visible.</p><Button variant="secondary" onClick={() => { const panel = document.getElementById('service-comparison'); if (panel) { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); } }}>Compare revisions</Button>{ctx.workspace.mode === 'historical' && <p>Retained snapshot: inspection only.</p>}</section>;
}

function Content({ ctx }) {
  const module = ctx.state.activeModule;
  const pendingRows = ctx.rows.filter(row => row.projection.resolution === 'open');
  if (module === 'account') return <section className="card card--p-sm"><h2>{ctx.session.displayName}</h2><p>Named server account · {ctx.session.actorId}</p><p>Session expires {ctx.session.absoluteExpiresAt}</p><p>Your access is checked by the service on every request. Passwords and session tokens are not stored in browser drafts.</p><Button variant="unstyled" className="btn" disabled={ctx.busy} onClick={ctx.signOut}>Sign out</Button></section>;
  if (!ctx.workspace) return <section className="card card--p-sm"><h2>{ctx.busy ? 'Loading your workspace…' : 'No registered input available'}</h2><p>{ctx.busy ? 'Reading the selected repository snapshot.' : 'The local operator must register an accepted inventory and discovery profile for a repository granted to your account.'}</p></section>;
  if (module === 'files') return <Files key={`${ctx.workspace.snapshot.id}-${ctx.state.sourceArtifactId || ''}`} ctx={ctx} />;
  if (module === 'changes') return <Relationships ctx={ctx} />;
  if (module === 'explore') return <><ServiceGraph key={ctx.workspace.snapshot.id} ctx={ctx} /><Relationships ctx={ctx} /></>;
  if (module === 'coverage') return <section className="service-coverage"><div className="service-section-heading"><h2>Processing coverage</h2><p>Completion applies to the accepted inventory for each function. Unsupported functions remain explicit.</p></div><div className="service-coverage-table"><div className="service-coverage-heading" aria-hidden="true"><span>Function</span><span>Status</span><span>Processed / Eligible</span></div>{ctx.workspace.snapshot.coverage.map(c => <section className="service-coverage-row" key={c.function}><div><h3>{c.function.replaceAll('_', ' ')}</h3><small>{c.excludedCount ?? 'Unknown'} excluded</small></div><span className={`service-chip service-chip--${c.status}`}>{c.status}</span><span className="service-coverage-count">{c.processedCount} / {c.eligibleCount ?? 'unknown'}</span>{!!c.limitations.length && <details><summary>Scope & limitations</summary><ul>{c.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></details>}</section>)}</div><Limitations ctx={ctx} /></section>;
  if (module === 'governance') return <section className="card card--p-sm"><h2>Repository access</h2><p>Current role: {ctx.descriptor.repositories.find(r => r.id === ctx.selection.repositoryId)?.role}</p><p>Accounts and grants are provisioned by the operator. Browser persona switching cannot change authority.</p><h3>Registered input</h3><p>Capture and discovery use the accepted local inventory and frozen profile. Neither action acquires or executes upstream source.</p><div className="service-toolbar">{[['capture_files', 'Capture accepted files'], ['discover_candidates', 'Discover unconfirmed candidates']].map(([command, label]) => <Button variant="unstyled" className="btn" disabled={!ctx.canWrite || ctx.busy} key={command} onClick={() => ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, command, { targetRevision: ctx.selection.targetRevision, inventoryId: ctx.selection.inventoryId, configurationId: ctx.selection.configurationId }))}>{label}</Button>)}</div>{ctx.operation && <section className="inline-notice"><p>Operation {ctx.operation.operationId} · {ctx.operation.status}</p><Button variant="unstyled" className="btn" onClick={ctx.checkOperation}>Check processing status</Button><pre className="service-json">{JSON.stringify(ctx.operation, null, 2)}</pre></section>}<Limitations ctx={ctx} /></section>;
  if (module === 'summary') return <><div className="service-stats"><section className="card card--p-sm"><h2>{ctx.workspace.snapshot.pendingReviewCount}</h2><p>Pending relationship reviews</p></section><section className="card card--p-sm"><h2>{ctx.workspace.snapshot.openFollowUpCount}</h2><p>Open follow-ups</p></section></div><p>Select a relationship to inspect judgments, reversals and independent follow-up work.</p><Relationships ctx={ctx} /><CycleActions key={ctx.workspace.snapshot.id} ctx={ctx} /></>;
  return <div className="service-home"><WorkspaceProgress ctx={ctx} /><section className="focus-brief service-home-brief"><div className="focus-brief__context"><GitBranch size={14} /><span>{ctx.state.repositories.find(r => r.id === ctx.selection.repositoryId)?.fullName || 'Repository workspace'}</span><span className="cycle-label">{ctx.workspace.mode} snapshot</span></div><h2>Pick up the thread.</h2><p>Review the connections between captured documents and code. Inspect the evidence, then leave the next person your judgment.</p><div className="focus-brief__actions"><Button onClick={() => ctx.switchModule('changes')}>Continue review <ArrowRight size={15} /></Button><Button variant="secondary" onClick={() => ctx.switchModule('files')}><FileCode2 size={15} />Read sources</Button></div><div className="focus-brief__summary"><span>{ctx.workspace.artifacts.length} captured artifacts</span><span>{ctx.rows.length} relationships</span><span>{ctx.workspace.snapshot.pendingReviewCount} pending reviews</span></div></section><div className="service-home-next"><div className="service-section-heading"><h2>Ready for review</h2><Button variant="ghost" size="sm" onClick={() => ctx.switchModule('changes')}>View all <ArrowRight size={14} /></Button></div>{pendingRows.slice(0, 3).map(row => <Button variant="unstyled" className="service-home-record" key={row.id} onClick={() => { ctx.switchModule('changes'); ctx.selectArtifact(row.id); }}><FileText size={17} /><span><strong>{row.sourceLabel || row.sourcePath}</strong><small>documents → {row.targetLabel || row.targetPath}</small></span><span className={`service-chip service-chip--${row.projection.validity}`}>{row.projection.validity}</span><ChevronRight size={14} /></Button>)}{!pendingRows.length && <p className="service-empty-note">No pending relationship reviews in this snapshot.</p>}</div><Limitations ctx={ctx} /></div>;

}

function Limitations({ ctx }) { return <details className="service-limitations"><summary><ShieldCheck size={15} />Coverage and method limitations <span>{ctx.workspace.snapshot.limitations.length}</span></summary><ul>{ctx.workspace.snapshot.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></details>; }

export default function ServiceApp() {
  const ctx = useContinuum();
  useEffect(() => { const handler = e => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) { ctx.closeModal(); ctx.closeCommandPalette(); ctx.closeInspector(); } if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ctx.openCommandPalette(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [ctx]);
  if (ctx.checking) return <main className="entry-page" role="status">Checking your session…</main>;
  if (!ctx.session) return <Login ctx={ctx} />;
  return <div className="service-app"><Shell {...ctx} onSwitchRepo={ctx.handleSwitchRepo} onOpenImportModal={() => ctx.switchModule('governance')} /><div className="workspace"><div className="workspace-body"><main className="canvas service-canvas" id="main-content" tabIndex={-1}>
    <header className="workspace-topline"><div><h1>{({ dashboard: 'Workspace', changes: 'Review relationships', summary: 'Review summary', files: 'Code explorer', explore: 'Explore context', coverage: 'Coverage', account: 'Account', governance: 'Team & governance' })[ctx.state.activeModule]}</h1><p className="service-page-context">{ctx.state.repositories.find(r => r.id === ctx.state.activeRepoId)?.fullName || 'Repository workspace'}<span>·</span>{ctx.selection?.targetRevision.commitId.slice(0, 7)}<span className="service-live-state">{ctx.workspace?.mode || 'No snapshot'}</span></p></div><Button variant="secondary" size="sm" disabled={ctx.busy || !ctx.selection} onClick={ctx.refresh}><RefreshCw size={15} />Refresh</Button></header>
    <div className="service-context-bar">{ctx.workspace && <details className="service-context"><summary>Revision & snapshot details</summary>    {ctx.selection && <p className="service-id">{ctx.selection.baseRevision ? 'Revision comparison' : 'Initial review'} · {ctx.selection.targetRevision.commitId} · snapshot {ctx.workspace?.snapshot.snapshotVersion ?? 'loading'}</p>}
    {ctx.workspace && <label className="service-toolbar">Retained snapshot<Select aria-label="Retained snapshot" value={ctx.workspace.snapshot.id} disabled={ctx.busy} onChange={e => ctx.openSnapshot(e.target.value)}>{ctx.retainedSnapshots.map(s => <option value={s.snapshotId} key={s.snapshotId}>Version {s.snapshotVersion} · {s.mode}</option>)}{!ctx.retainedSnapshots.some(s => s.snapshotId === ctx.workspace.snapshot.id) && <option value={ctx.workspace.snapshot.id}>Version {ctx.workspace.snapshot.snapshotVersion} · {ctx.workspace.mode}</option>}</Select></label>}</details>}
    {ctx.workspace && <CompareRevisions key={ctx.selection.targetRevision.commitId} ctx={ctx} />}
    </div>
    {ctx.workspace?.comparison && <section className="inline-notice"><strong>{ctx.workspace.comparison.changes.length} changed paths · {ctx.workspace.comparison.impacts.length} affected relationships</strong><details><summary>Inspect source changes</summary>{ctx.workspace.comparison.changes.map(c => <p key={c.path}>{c.kind} · {c.path}</p>)}{ctx.workspace.comparison.limitations.map(l => <p key={l}>{l}</p>)}</details></section>}

    {ctx.error && <p className="inline-notice form-error" role="alert">{ctx.error}</p>}{ctx.notice && <p role="status">{ctx.notice}</p>}
    {ctx.pending && !ctx.busy && <section className="inline-notice"><p>A request is retained for account {ctx.session.displayName}. Its result has not been reconciled. Retry sends the same request ID and input.</p><Button variant="unstyled" className="btn" disabled={ctx.busy} onClick={ctx.retryPending}>Retry retained request</Button></section>}
    {ctx.busy && <p role="status">Updating workspace…</p>}
    <Content ctx={ctx} />
  </main>{ctx.state.inspectorOpen && <Inspector key={ctx.state.selectedArtifactId} ctx={ctx} />}</div></div>{ctx.modalOpen && <RecordDialog ctx={ctx} />}
    {ctx.isCommandPaletteOpen && <Dialog open onOpenChange={open => !open && ctx.closeCommandPalette()}><DialogContent className="service-dialog service-search-dialog" padded={false} showClose={false} aria-labelledby="service-search-title" aria-describedby="service-search-description"><header className="service-search-header"><Search size={19} /><div><DialogTitle id="service-search-title">Search current snapshot</DialogTitle><DialogDescription id="service-search-description">Find captured relationships in the selected repository and revision.</DialogDescription></div><Button variant="ghost" size="icon-sm" onClick={ctx.closeCommandPalette} aria-label="Close search"><X size={18} /></Button></header><div className="service-search-body"><ServiceSearch ctx={ctx} /></div></DialogContent></Dialog>}

  </div>;
}
