import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ContinuumContext } from './ContinuumBase.js';
import { ContinuumApi } from '../data/serviceApi.js';
import { chooseSelection, contextEnvelope, DraftStore, draftKey, emptyDraft, initialServiceState, judgmentInput, reviewRows } from '../data/serviceModel.js';

export default function ServiceContinuumProvider({ children }) {
  const [api] = useState(() => new ContinuumApi());
  const epoch = useRef(0);
  const store = useRef(null);
  const drafts = useRef({});
  const lock = useRef(false);
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState(initialServiceState);
  const [descriptor, setDescriptor] = useState(null);
  const [selection, setSelection] = useState(null);
  const [repositoryViewId, setRepositoryViewId] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState('light');
  const [modalOpen, setModalOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [retainedSnapshots, setRetainedSnapshots] = useState([]);
  const [formDrafts, setFormDrafts] = useState({});
  const [operation, setOperation] = useState(null);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  function report(e) {
    setError(e.message);
    if (e.status === 401) { ++epoch.current; setSession(null); setDetail(null); setWorkspace(null); }
  }
  function persist(next) { store.current.save(next); drafts.current = next; }
  async function loadWorkspace(chosen) {
    const generation = ++epoch.current;
    setBusy(true); setError(''); setDetail(null); setWorkspace(null);
    setState(s => ({ ...s, selectedArtifactId: null, inspectorOpen: false, activeRepoId: chosen.repositoryId }));
    try {
      const selected = await api.query(chosen.repositoryId, 'select_context', chosen);
      const data = await api.query(chosen.repositoryId, 'read_workspace', { snapshotId: selected.snapshot.id });
      if (generation !== epoch.current) return;
      const retained = await api.query(chosen.repositoryId, 'list_snapshots', { repositoryViewId: selected.repositoryViewId });
      if (generation !== epoch.current) return;
      setRetainedSnapshots(retained.items); setSelection(selected.selection); setRepositoryViewId(selected.repositoryViewId); setWorkspace(data);
    } catch (e) { if (generation === epoch.current) report(e); }
    finally { if (generation === epoch.current) setBusy(false); }
  }
  async function enter(actor) {
    setSession(actor);
    store.current = new DraftStore(localStorage, actor.actorId);
    try { drafts.current = store.current.load(); setPending(drafts.current.$pending || null); setFormDrafts(drafts.current.$forms || {}); setOperation(drafts.current.$operation || null); setStorageReady(true); }
    catch { drafts.current = {}; setStorageReady(false); setError('Saved drafts could not be read. Existing browser storage is preserved; writes are disabled.'); }
    const data = await api.workspace();
    setDescriptor(data);
    const repositories = data.repositories.map(r => ({ ...r, fullName: r.inputs[0]?.repositoryFullName || r.name, language: r.inputs[0]?.language || 'Repository' }));
    setState(s => ({ ...initialServiceState(), activeModule: s.activeModule, repositories, activeUserId: actor.actorId,
      teamMembers: [{ id: actor.actorId, name: actor.displayName, shortName: actor.displayName, initials: actor.displayName.slice(0, 2).toUpperCase(), authority: repositories[0]?.role === 'reviewer' ? 'Authorized Reviewer' : 'Read-Only Viewer' }] }));
    const chosen = chooseSelection(data.repositories[0]);
    if (chosen) await loadWorkspace(chosen);
  }
  const restoreSession = useEffectEvent(actor => enter(actor));
  useEffect(() => {
    let active = true;
    api.session().then(actor => { if (active) return restoreSession(actor); }).catch(e => { if (active && e.status !== 401) report(e); }).finally(() => { if (active) setChecking(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- This ref is a request generation counter, not a DOM ref.
    return () => { active = false; ++epoch.current; };
  }, [api]); // One cookie-session bootstrap per mount.
  async function signIn(login, password) { setError(''); await enter(await api.signIn(login, password)); }
  async function signOut() {
    if (lock.current) return;
    try { await api.signOut(); ++epoch.current; setSession(null); setDescriptor(null); setWorkspace(null); setSelection(null); setDetail(null); setPending(null); setState(initialServiceState()); drafts.current = {}; store.current = null; }
    catch (e) { report(e); }
  }
  async function selectArtifact(contextId) {
    const generation = ++epoch.current;
    setDetail(null); setError('');
    setState(s => ({ ...s, selectedArtifactId: contextId, inspectorOpen: true }));
    try {
      const view = await api.query(selection.repositoryId, 'open_review_view', { repositoryViewId, snapshotId: workspace.snapshot.id, contextId });
      const [context, history] = await Promise.all([api.context(selection.repositoryId, contextId, view.viewId), api.history(selection.repositoryId, contextId, view.viewId)]);
      const versions = [...new Set([context.assertion.source.versionId, context.assertion.target.versionId].filter(Boolean))];
      const [sources, evidence] = await Promise.all([Promise.all(versions.map(id => api.version(selection.repositoryId, id))), Promise.all(context.evidence.map(e => api.evidence(selection.repositoryId, e.id)))]);
      if (generation !== epoch.current) return;
      const data = { ...context, history, sources, evidence };
      setDetail(data); setDraft({ ...emptyDraft(), ...drafts.current[draftKey(selection, data)] });
    } catch (e) { if (generation === epoch.current) report(e); }
  }
  async function openPriorDecision() {
    const impact = workspace?.comparison?.impacts.find(i => i.contextId === detail?.projection.contextId);
    if (!impact) return;
    const generation = ++epoch.current;
    const returnContextId = detail.projection.contextId;
    setBusy(true); setError('');
    try {
      const earlier = await api.query(selection.repositoryId, 'read_workspace', { snapshotId: workspace.comparison.baseSnapshotId });
      const item = earlier.assertions.find(i => i.projection.contextId === impact.baseContextId);
      if (!item) throw new Error('The retained prior context is unavailable.');
      const context = await api.query(selection.repositoryId, 'read_assertion', { snapshotId: earlier.snapshot.id, contextId: impact.baseContextId, assertionRevisionId: item.assertion.id, historical: true });
      const [history, sources, evidence] = await Promise.all([api.history(selection.repositoryId, impact.baseContextId, context.viewId), Promise.all([...new Set([context.assertion.source.versionId, context.assertion.target.versionId].filter(Boolean))].map(id => api.version(selection.repositoryId, id))), Promise.all(context.evidence.map(e => api.evidence(selection.repositoryId, e.id)))]);
      if (generation === epoch.current) setDetail({ ...context, history, sources, evidence, returnContextId });
    } catch (e) { if (generation === epoch.current) report(e); }
    finally { if (generation === epoch.current) setBusy(false); }
  }
  async function loadMoreHistory() {
    if (!detail?.history.nextCursor || lock.current) return;
    lock.current = true; setBusy(true);
    const generation = epoch.current;
    try {
      const page = await api.history(selection.repositoryId, detail.projection.contextId, detail.viewId, detail.history.nextCursor);
      if (generation === epoch.current) setDetail(current => ({ ...current, history: { ...page, items: [...current.history.items, ...page.items.filter(item => !current.history.items.some(old => old.id === item.id))] } }));
    } catch (e) { if (generation === epoch.current) report(e); }
    finally { lock.current = false; setBusy(false); }
  }
  function updateDraft(patch) {
    const next = { ...draft, ...patch };
    try { persist({ ...drafts.current, [draftKey(selection, detail)]: next }); setDraft(next); }
    catch (e) { report(new Error(`Draft could not be saved: ${e.message}`)); }
  }
  async function submit(envelope, key = null) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const saved = { envelope, draftKey: key };
    try {
      if (pending && JSON.stringify(pending.envelope) !== JSON.stringify(envelope)) throw new Error('Resolve the retained request before submitting another command.');
      persist({ ...drafts.current, $pending: saved }); setPending(saved);
      const response = await api.command(envelope);
      const next = { ...drafts.current }; delete next.$pending; if (key) delete next[key]; persist(next); setPending(null);
      if (response.result.operationId) {
        const admitted = { repositoryId: envelope.repositoryId, command: envelope.command, snapshotId: envelope.input.snapshotId, ...response.result };
        persist({ ...drafts.current, $operation: admitted }); setOperation(admitted);
      }
      setNotice('Saved to the service.');
      if (envelope.command !== 'export_snapshot' && selection?.repositoryId === envelope.repositoryId) await loadWorkspace(response.result.selection || selection);
      return response;
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 401) {
        const next = { ...drafts.current }; delete next.$pending;
        try { persist(next); setPending(null); } catch { /* Retain original request if storage failed. */ }
      }
      report(e);
    } finally { lock.current = false; setBusy(false); }
  }
  async function saveJudgment() {
    try { await submit(contextEnvelope(selection, detail, 'record_judgment', judgmentInput(detail, draft)), draftKey(selection, detail)); }
    catch (e) { report(e); }
  }
  const activeRepository = descriptor?.repositories.find(r => r.id === state.activeRepoId);
  const canWrite = activeRepository?.role === 'reviewer' && workspace?.mode === 'active' && storageReady && !pending;
  const value = { serviceMode: true, api, session, checking, signIn, signOut, state, setState, descriptor, selection, repositoryViewId, workspace, detail, draft, updateDraft,
    rows: reviewRows(workspace), openPriorDecision, loadMoreHistory, openSource: artifactId => { setState(s => ({ ...s, activeModule: 'files', sourceArtifactId: artifactId, inspectorOpen: false })); setCommandPaletteOpen(false); }, error, notice, busy, canWrite, pending, report, submit, saveJudgment,
    retryPending: () => pending && submit(pending.envelope, pending.draftKey),
    refresh: () => selection && loadWorkspace(selection),
    retainedSnapshots, openSnapshot: async snapshotId => {
      const generation = ++epoch.current; setDetail(null); setError(''); setBusy(true); setState(s => ({ ...s, inspectorOpen: false }));
      try { const data = await api.query(selection.repositoryId, 'read_workspace', { snapshotId }); if (generation === epoch.current) setWorkspace(data); }
      catch (e) { if (generation === epoch.current) report(e); }
      finally { if (generation === epoch.current) setBusy(false); }
    },
    formDrafts, saveFormDraft: (key, data) => { try { const next = { ...formDrafts, [key]: data }; persist({ ...drafts.current, $forms: next }); setFormDrafts(next); } catch (e) { report(e); } },
    operation, checkOperation: async () => {
      try { const result = await api.query(operation.repositoryId, 'read_operation', { operationId: operation.operationId });
        const next = { ...operation, ...result }; persist({ ...drafts.current, $operation: next }); setOperation(next);
      } catch (e) { report(e); }
    },
    changeSelection: chosen => { if (!lock.current) loadWorkspace(chosen); },
    handleSwitchRepo: id => { const chosen = chooseSelection(descriptor.repositories.find(r => r.id === id)); if (chosen) loadWorkspace(chosen); },
    selectArtifact, closeInspector: () => { ++epoch.current; setDetail(null); setState(s => ({ ...s, inspectorOpen: false })); },
    switchModule: activeModule => setState(s => ({ ...s, activeModule })),
    pendingCount: workspace?.snapshot.pendingReviewCount || 0, theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    modalOpen, openModal: () => setModalOpen(true), closeModal: () => setModalOpen(false),
    isCommandPaletteOpen, setCommandPaletteOpen, openCommandPalette: () => setCommandPaletteOpen(true), closeCommandPalette: () => setCommandPaletteOpen(false),
  };
  return <ContinuumContext.Provider value={value}>{children}</ContinuumContext.Provider>;
}
