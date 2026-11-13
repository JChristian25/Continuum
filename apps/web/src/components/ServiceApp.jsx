import { lazy, Suspense, useEffect, useState } from 'react';
import { Infinity as InfinityIcon, ArrowRight, X, RefreshCw } from 'lucide-react';
import Shell from './Shell.jsx';
import { useContinuum } from '../context/ContinuumBase.js';
import { contextEnvelope, permittedDecisions } from '../data/serviceModel.js';
import './service.css';

const TraceabilityFlow = lazy(() => import('./TraceabilityFlow.jsx'));

function Login({ ctx }) {
  const [login, setLogin] = useState('jc');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="entry-page"><header className="entry-brand"><InfinityIcon size={32} /><span>Continuum</span></header><div className="entry-layout">
    <section className="entry-story"><h1>Good decisions deserve<br />a little continuity.</h1><p>Follow a change. Understand its connections. Leave the next person the context they need.</p><div className="entry-example"><span>Repository context</span><p>Exact sources. Inspectable decisions.</p><div><span>Code</span><ArrowRight size={15} /><span>Evidence</span><ArrowRight size={15} /><span>Your judgment</span></div></div><p className="entry-footnote">Your account opens the repositories granted to you.</p></section>
    <section className="auth-panel"><h2>Welcome back to Continuum.</h2><p>Sign in to pick up the thread of your repository.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await ctx.signIn(login, password); } catch (err) { setError(err.message); } finally { setPassword(''); setBusy(false); } }}>
      <label>Login<input autoComplete="username" required value={login} onChange={e => setLogin(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {(error || ctx.error) && <p className="form-error" role="alert">{error || ctx.error}</p>}
      <button className="btn btn--accent auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button>
    </form><p className="auth-boundary">Accounts are provisioned by the local operator. Session access is stored in an HTTP-only cookie.</p></section>
  </div></main>;
}

function Source({ source }) {
  if (!source) return <p>Exact source is unavailable.</p>;
  return <section className="code-box"><div className="code-box__header"><strong>{source.identity.path || source.identity.title || source.id}</strong></div><details><summary>Exact version identity</summary><pre className="service-json">{JSON.stringify({ id: source.id, identity: source.identity, digest: source.contentDigest }, null, 2)}</pre></details><div className="code-box__body">{source.content.split('\n').map((line, i) => <div className="code-line" key={i}><span className="code-line__num">{i + 1}</span><span className="code-line__text">{line || ' '}</span></div>)}</div></section>;
}

function Relationships({ ctx }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = ctx.rows.filter(r => `${r.sourcePath} ${r.targetPath} ${r.assertion.methodId}`.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || r.projection.validity === status));
  return <><div className="service-toolbar"><label>Search relationships<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Path or discovery method" /></label><label>Validity<select value={status} onChange={e => setStatus(e.target.value)}>{['all', 'candidate', 'confirmed', 'rejected', 'stale', 'retired'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <div className="service-list">{rows.map(row => <button className={`service-row ${ctx.state.selectedArtifactId === row.id ? 'is-selected' : ''}`} key={row.id} onClick={() => ctx.selectArtifact(row.id)} disabled={ctx.busy}>
      <span><strong>{row.sourcePath}</strong><small>documents → {row.targetPath}</small></span><span><span className="service-chip">{row.projection.validity}</span><small>{row.projection.resolution} · {row.assertion.methodId}</small></span>
    </button>)}{!rows.length && <div className="queue-empty">No matching relationships in this snapshot.</div>}</div></>;
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
  return <aside className="inspector service-inspector" aria-label="Relationship inspector"><header className="inspector__header"><h2>Relationship context</h2><button className="btn btn--ghost" aria-label="Close inspector" onClick={ctx.closeInspector}><X size={18} /></button></header>
    {!d ? <p className="service-padding" role="status">{ctx.error ? 'Context could not be loaded.' : 'Loading exact evidence…'}</p> : <div className="inspector__body">
      <p><strong>{d.projection.validity}</strong> · {d.projection.resolution} · {d.mode}</p><small className="service-id">Context {d.projection.contextId}<br />Assertion revision {d.assertion.id}<br />Projection {d.projection.projectionVersion}</small>
      <div className="service-toolbar">{['evidence', 'review', 'history'].map(t => <button className={`btn ${tab === t ? 'btn--accent' : ''}`} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'evidence' && <><p>Method: {d.assertion.methodId}. Candidate links require human judgment.</p>{d.assertion.limitations.map((l, i) => <p key={i} className="inline-notice">{l}</p>)}{d.sources.map(s => <Source key={s.id} source={s} />)}
        <h3>Recorded evidence</h3>{d.evidence.map(e => <section className="card card--p-sm" key={e.id}><strong>{e.availability}</strong><p className="service-id">{e.id}</p><pre className="service-json">{JSON.stringify(e.locator)}</pre><pre className="service-excerpt">{e.excerpt ?? e.reason ?? 'No resolvable excerpt.'}</pre></section>)}
        <details><summary>Processing provenance</summary><pre className="service-json">{JSON.stringify(d.provenance, null, 2)}</pre></details></>}
      {tab === 'review' && <><form className="journey-form" onSubmit={e => { e.preventDefault(); ctx.saveJudgment(); }}>
        <label>Relationship judgment<select value={draft.decision} disabled={!mutable} onChange={e => ctx.updateDraft({ decision: e.target.value })}><option value="">Choose a judgment</option>{permittedDecisions(d.projection).map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Reason<textarea value={draft.reason} disabled={!mutable} required maxLength={4000} onChange={e => ctx.updateDraft({ reason: e.target.value })} /></label>
        <label className="service-checkbox"><input type="checkbox" checked={draft.inspected} disabled={!mutable} onChange={e => ctx.updateDraft({ inspected: e.target.checked })} />I inspected the exact sources and recorded evidence.</label>
        <label>Content concern (independent of relationship validity)<textarea value={draft.contentConcern} disabled={!mutable} maxLength={4000} onChange={e => ctx.updateDraft({ contentConcern: e.target.value })} /></label>
        <label>Follow-up work<select value={draft.followUpKind} disabled={!mutable} onChange={e => ctx.updateDraft({ followUpKind: e.target.value })}><option value="none">None</option><option value="documentation_update">Documentation update</option><option value="code_update">Code update</option></select></label>
        {draft.followUpKind !== 'none' && <label>Work description<textarea value={draft.followUpNote} disabled={!mutable} required onChange={e => ctx.updateDraft({ followUpNote: e.target.value })} /></label>}
        <button className="btn btn--accent" disabled={!mutable || !permittedDecisions(d.projection).length}>Save judgment</button><small>Drafts are kept in this browser under your account and exact context.</small>
      </form><h3>Independent follow-up</h3><label className="journey-form">Verification or work note<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
        <button className="btn" disabled={!mutable || !note.trim()} onClick={() => command('open_follow_up', { workKind: 'documentation_update', note, relatedJudgmentEventId: null })}>Open documentation follow-up</button>
        {d.followUps.map(w => <div className="card card--p-sm" key={w.id}><p>{w.kind} · {w.status}</p><small className="service-id">{w.id}</small>{w.status === 'open' && <button className="btn" disabled={!mutable || !note.trim()} onClick={() => command('resolve_follow_up', { followUpId: w.id, verificationNote: note })}>Resolve with verification note</button>}</div>)}
        {d.projection.effectiveJudgmentEventId && <button className="btn" disabled={!mutable || !note.trim()} onClick={() => command('reverse_judgment', { eventId: d.projection.effectiveJudgmentEventId, reason: note })}>Append reversal of effective judgment</button>}
        {!mutable && <p className="inline-notice">This view is read-only. Current reviewer access and a fresh snapshot are required to write.</p>}
      </>}
      {tab === 'history' && <><p>History is retained at this snapshot’s sequence boundary.</p>{d.history.items.map(e => <div className="card card--p-sm" key={e.id}><strong>{e.type}</strong><p>{e.reason}</p><small>{e.recordedAt} · {e.actorId} · sequence {e.sequence}</small><details><summary>Event details</summary><pre className="service-json">{JSON.stringify(e, null, 2)}</pre></details></div>)}{!d.history.items.length && <p>No review events at this snapshot.</p>}{d.history.nextCursor && <p>Additional retained events are available through the history API.</p>}</>}
    </div>}
  </aside>;
}

function Files({ ctx }) {
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!selected?.versionId) return;
    const abort = new AbortController();
    ctx.api.version(ctx.selection.repositoryId, selected.versionId, abort.signal).then(data => setSelected(s => s?.versionId === data.id ? { ...s, data } : s)).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [selected?.versionId, ctx.selection.repositoryId, ctx.api]);
  return <><label className="journey-form">Search captured paths<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="service-file-grid"><div className="service-list">{ctx.workspace.artifacts.filter(a => a.path.toLowerCase().includes(search.toLowerCase())).map(a => <button className="service-row" key={a.versionId} onClick={() => { setError(''); setSelected(a); }}><span><strong>{a.path}</strong><small>{a.kind} · {a.identity.kind === 'record' ? `record version ${a.identity.recordVersion}` : a.identity.format}</small></span></button>)}</div><div>{error && <p role="alert">{error}</p>}{selected?.data ? <Source source={selected.data} /> : <p>Select a captured file or authored record to read its exact version.</p>}</div></div></>;
}

function RecordDialog({ ctx }) {
  const key = JSON.stringify(['record', ctx.selection.repositoryId, ctx.selection.targetRevision.commitId]);
  const form = ctx.formDrafts[key] || { title: '', content: '', kind: 'decision', reason: '' };
  const { title, content, kind, reason } = form;
  const update = patch => ctx.saveFormDraft(key, { ...form, ...patch });
  const setTitle = title => update({ title }); const setContent = content => update({ content }); const setKind = kind => update({ kind }); const setReason = reason => update({ reason });
  return <div className="service-overlay"><section role="dialog" aria-modal="true" aria-labelledby="record-title" className="auth-panel service-dialog"><button className="btn service-dialog-close" onClick={ctx.closeModal} aria-label="Close record form"><X size={18} /></button><h2 id="record-title">Record intent</h2><p>Save an authored record. This does not confirm a relationship.</p><form className="journey-form" onSubmit={async e => { e.preventDefault(); const saved = await ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, 'capture_record', { kind, title, content, sourceReference: null, sourceAbsenceReason: reason })); if (saved) { ctx.saveFormDraft(key, { title: '', content: '', kind: 'decision', reason: '' }); ctx.closeModal(); } }}>
    <label>Kind<select value={kind} onChange={e => setKind(e.target.value)}><option value="decision">Decision</option><option value="requirement">Requirement</option></select></label><label>Title<input value={title} required maxLength={200} onChange={e => setTitle(e.target.value)} /></label><label>Content<textarea required value={content} maxLength={65536} onChange={e => setContent(e.target.value)} /></label><label>Why is no source reference supplied?<textarea required value={reason} maxLength={4000} onChange={e => setReason(e.target.value)} /></label><button className="btn btn--accent" disabled={!ctx.canWrite || ctx.busy}>Save record</button></form><p className="form-error" role="alert">{ctx.error}</p>{ctx.notice && <p role="status">{ctx.notice}</p>}</section></div>;
}

function Content({ ctx }) {
  const module = ctx.state.activeModule;
  if (module === 'account') return <section className="card card--p-sm"><h2>{ctx.session.displayName}</h2><p>Named server account · {ctx.session.actorId}</p><p>Session expires {ctx.session.absoluteExpiresAt}</p><p>Your access is checked by the service on every request. Passwords and session tokens are not stored in browser drafts.</p><button className="btn" disabled={ctx.busy} onClick={ctx.signOut}>Sign out</button></section>;
  if (!ctx.workspace) return <section className="card card--p-sm"><h2>{ctx.busy ? 'Loading your workspace…' : 'No registered input available'}</h2><p>{ctx.busy ? 'Reading the selected repository snapshot.' : 'The local operator must register an accepted inventory and discovery profile for a repository granted to your account.'}</p></section>;
  if (module === 'files') return <Files key={ctx.workspace.snapshot.id} ctx={ctx} />;
  if (module === 'changes') return <Relationships ctx={ctx} />;
  if (module === 'explore') return <><p>Relationships in this exact snapshot. Candidate edges remain unconfirmed; this is not a semantic dependency map.</p><Suspense fallback={<p>Loading graph…</p>}><TraceabilityFlow rawNodes={ctx.workspace.artifacts.map(a => ({ id: a.artifactId, title: a.path.split('/').at(-1), sub: a.path, category: a.kind }))} rawEdges={ctx.rows.map(r => ({ from: r.assertion.source.artifactId, to: r.assertion.target.artifactId, label: r.projection.validity, kind: r.projection.validity }))} onSelectNode={id => { const row = ctx.rows.find(r => r.assertion.source.artifactId === id || r.assertion.target.artifactId === id); if (row) ctx.selectArtifact(row.id); }} theme={ctx.theme} /></Suspense><Relationships ctx={ctx} /></>;
  if (module === 'coverage') return <><div className="service-list">{ctx.workspace.snapshot.coverage.map(c => <section className="card card--p-sm" key={c.function}><h3>{c.function} · {c.status}</h3><p>{c.processedCount} processed / {c.eligibleCount ?? 'unknown'} eligible · {c.excludedCount ?? 'unknown'} excluded</p>{c.limitations.map((l, i) => <p key={i}>{l}</p>)}</section>)}</div><Limitations ctx={ctx} /></>;
  if (module === 'governance') return <section className="card card--p-sm"><h2>Repository access</h2><p>Current role: {ctx.descriptor.repositories.find(r => r.id === ctx.selection.repositoryId)?.role}</p><p>Accounts and grants are provisioned by the operator. Browser persona switching cannot change authority.</p><h3>Registered input</h3><p>Capture and discovery use the accepted local inventory and frozen profile. Neither action acquires or executes upstream source.</p><div className="service-toolbar">{[['capture_files', 'Capture accepted files'], ['discover_candidates', 'Discover unconfirmed candidates']].map(([command, label]) => <button className="btn" disabled={!ctx.canWrite || ctx.busy} key={command} onClick={() => ctx.submit(contextEnvelope(ctx.selection, { viewId: ctx.repositoryViewId }, command, { targetRevision: ctx.selection.targetRevision, inventoryId: ctx.selection.inventoryId, configurationId: ctx.selection.configurationId }))}>{label}</button>)}</div>{ctx.operation && <section className="inline-notice"><p>Operation {ctx.operation.operationId} · {ctx.operation.status}</p><button className="btn" onClick={ctx.checkOperation}>Check processing status</button><pre className="service-json">{JSON.stringify(ctx.operation, null, 2)}</pre></section>}<Limitations ctx={ctx} /></section>;
  if (module === 'summary') return <><div className="service-stats"><section className="card card--p-sm"><h2>{ctx.workspace.snapshot.pendingReviewCount}</h2><p>Pending relationship reviews</p></section><section className="card card--p-sm"><h2>{ctx.workspace.snapshot.openFollowUpCount}</h2><p>Open follow-ups</p></section></div><p>Select a relationship to inspect judgments, reversals and independent follow-up work.</p><Relationships ctx={ctx} /><p className="inline-notice">Cycle completion and export are not yet implemented.</p></>;
  return <><section className="focus-brief card card--p-sm"><small>SELECTED REPOSITORY SNAPSHOT</small><h2>Pick up the thread.</h2><p>{ctx.workspace.artifacts.length} captured artifacts · {ctx.rows.length} relationships · {ctx.workspace.snapshot.pendingReviewCount} pending reviews</p><div className="service-toolbar"><button className="btn btn--accent" onClick={() => ctx.switchModule('changes')}>Review relationships <ArrowRight size={15} /></button><button className="btn" onClick={() => ctx.switchModule('files')}>Read sources</button></div></section><h2>Review queue</h2><Relationships ctx={ctx} /><Limitations ctx={ctx} /></>;
}

function Limitations({ ctx }) { return <details className="card card--p-sm"><summary>Coverage and method limitations</summary>{ctx.workspace.snapshot.limitations.map((l, i) => <p key={i}>{l}</p>)}</details>; }

export default function ServiceApp() {
  const ctx = useContinuum();
  useEffect(() => { const handler = e => { if (e.key === 'Escape') { ctx.closeModal(); ctx.closeCommandPalette(); ctx.closeInspector(); } if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ctx.openCommandPalette(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [ctx]);
  if (ctx.checking) return <main className="entry-page" role="status">Checking your session…</main>;
  if (!ctx.session) return <Login ctx={ctx} />;
  return <div className="service-app"><Shell {...ctx} onSwitchRepo={ctx.handleSwitchRepo} onOpenImportModal={() => ctx.switchModule('governance')} /><div className="workspace"><div className="workspace-body"><main className="canvas service-canvas" id="main-content" tabIndex={-1}>
    <header className="workspace-topline"><div><small>LIVE SERVICE · {ctx.workspace?.mode || 'NO SNAPSHOT'}</small><h1>{({ dashboard: 'Workspace', changes: 'Review relationships', summary: 'Review summary', files: 'Code explorer', explore: 'Explore context', coverage: 'Coverage', account: 'Account', governance: 'Team & governance' })[ctx.state.activeModule]}</h1></div><button className="btn" disabled={ctx.busy || !ctx.selection} onClick={ctx.refresh}><RefreshCw size={15} />Refresh</button></header>
    {ctx.selection && <p className="service-id">Initial review · {ctx.selection.targetRevision.commitId} · snapshot {ctx.workspace?.snapshot.snapshotVersion ?? 'loading'}</p>}
    {ctx.workspace && <label className="service-toolbar">Retained snapshot<select aria-label="Retained snapshot" value={ctx.workspace.snapshot.id} disabled={ctx.busy} onChange={e => ctx.openSnapshot(e.target.value)}>{ctx.retainedSnapshots.map(s => <option value={s.snapshotId} key={s.snapshotId}>Version {s.snapshotVersion} · {s.mode}</option>)}{!ctx.retainedSnapshots.some(s => s.snapshotId === ctx.workspace.snapshot.id) && <option value={ctx.workspace.snapshot.id}>Version {ctx.workspace.snapshot.snapshotVersion} · {ctx.workspace.mode}</option>}</select></label>}
    {ctx.error && <p className="inline-notice form-error" role="alert">{ctx.error}</p>}{ctx.notice && <p role="status">{ctx.notice}</p>}
    {ctx.pending && <section className="inline-notice"><p>A request is retained for account {ctx.session.displayName}. Its result has not been reconciled. Retry sends the same request ID and input.</p><button className="btn" disabled={ctx.busy} onClick={ctx.retryPending}>Retry retained request</button></section>}
    <Content ctx={ctx} />
  </main>{ctx.state.inspectorOpen && <Inspector key={ctx.state.selectedArtifactId} ctx={ctx} />}</div></div>{ctx.modalOpen && <RecordDialog ctx={ctx} />}
    {ctx.isCommandPaletteOpen && <div className="service-overlay"><section className="auth-panel service-dialog" role="dialog" aria-modal="true" aria-label="Search current snapshot"><button className="btn" onClick={ctx.closeCommandPalette}>Close</button><h2>Search current snapshot</h2><Relationships ctx={ctx} /></section></div>}
  </div>;
}
