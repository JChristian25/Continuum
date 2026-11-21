import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ContinuumContext } from './ContinuumBase.js';
import { clearImport, readImport, rememberImport } from '../data/importRecovery.js';
import { ContinuumApi } from '../data/serviceApi.js';
import { chooseSelection, contextEnvelope, DraftStore, draftKey, emptyDraft, initialServiceState, judgmentInput, returningSelection, reviewRows } from '../data/serviceModel.js';

const COMMAND_NOTICES = {
  record_judgment: 'Judgment recorded',
  triage_candidate: 'Queue updated',
  capture_candidate: 'Candidate relationship proposed',
  correct_assertion: 'Correction saved for review',
  reverse_judgment: 'Judgment reversal recorded',
  open_follow_up: 'Follow-up task opened',
  resolve_follow_up: 'Follow-up task resolved',
  capture_record: 'Record saved',
  revise_record: 'New record version saved',
  compare_revisions: 'Revision comparison ready',
  complete_cycle: 'Review sign-off recorded',
  export_snapshot: 'JSON export queued',
  capture_files: 'Source capture queued',
  discover_candidates: 'Candidate discovery queued',
};

function commandNotice(envelope) {
  if (envelope.command === 'triage_candidate') {
    const disp = envelope.input?.disposition;
    if (disp === 'defer') return 'Candidate deferred';
    if (disp === 'screen') return 'Suggestion screened out';
    if (disp === 'restore') return 'Restored to suggestions';
  }
  return COMMAND_NOTICES[envelope.command] || 'Saved';
}

export default function ServiceContinuumProvider({ children }) {
  const [api] = useState(() => new ContinuumApi());
  const epoch = useRef(0);
  const store = useRef(null);
  const workspacePreferenceKey = useRef(null);
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
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('CONTINUUM_THEME');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* Storage optional */ }
    return 'light';
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState(null);
  const [workspaceModalMode, setWorkspaceModalMode] = useState(null); // null | 'create' | 'add_revision'
  const [relationshipSeed, setRelationshipSeed] = useState(null);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [retainedSnapshots, setRetainedSnapshots] = useState([]);
  const [formDrafts, setFormDrafts] = useState({});
  const [operation, setOperation] = useState(null);
  const [recoverableImport, setRecoverableImport] = useState(null);
  const [followLive, setFollowLive] = useState(true);
  const selectionRef = useRef(null);
  const repoViewRef = useRef(null);
  const workspaceRef = useRef(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('CONTINUUM_THEME', theme); } catch { /* Storage optional */ }
  }, [theme]);
  useEffect(() => {
    if (!notice || busy) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice, busy]);
  function report(e) {
    setError(e.message);
    if (e.status === 401) { ++epoch.current; setSession(null); setDetail(null); setWorkspace(null); setRecoverableImport(null); store.current = null; selectionRef.current = null; repoViewRef.current = null; workspaceRef.current = null; }
  }
  function persist(next) { store.current.save(next); drafts.current = next; }
  async function loadWorkspace(chosen, restoring = false) {
    const generation = ++epoch.current;
    setBusy(true); setError(''); setDetail(null); setWorkspace(null);
    setState(s => ({ ...s, selectedArtifactId: null, inspectorOpen: false, activeRepoId: chosen.repositoryId }));
    try {
      let selected;
      try {
        selected = await api.query(chosen.repositoryId, 'select_context', chosen);
      } catch (e) {
        if (generation !== epoch.current || !restoring || !chosen.comparisonId ||
            !['not_found', 'invalid_input', 'revision_unavailable'].includes(e.code)) throw e;
        const initial = { ...chosen, baseRevision: null };
        delete initial.comparisonId;
        selected = await api.query(initial.repositoryId, 'select_context', initial);
      }
      const data = await api.query(chosen.repositoryId, 'read_workspace', { snapshotId: selected.snapshot.id });
      if (generation !== epoch.current) return null;
      const retained = await api.query(chosen.repositoryId, 'list_snapshots', { repositoryViewId: selected.repositoryViewId });
      if (generation !== epoch.current) return null;
      selectionRef.current = selected.selection;
      repoViewRef.current = selected.repositoryViewId;
      workspaceRef.current = data; setFollowLive(true);
      try { localStorage.setItem(workspacePreferenceKey.current, JSON.stringify(selected.selection)); } catch { /* Navigation preferences are optional. */ }
      setRetainedSnapshots(retained.items); setSelection(selected.selection); setRepositoryViewId(selected.repositoryViewId); setWorkspace(data);
      return data;
    } catch (e) { if (generation === epoch.current) report(e); return null; }
    finally { if (generation === epoch.current) setBusy(false); }
  }
  function formatRepositories(data) {
    return (data?.repositories || []).map(r => ({
      ...r,
      fullName: r.inputs[0]?.repositoryFullName || r.name,
      language: r.inputs[0]?.language || 'Repository',
      isCustom: r.inputs.some(i => i.isCustom),
    }));
  }
  async function enter(actor) {
    const generation = ++epoch.current;
    workspacePreferenceKey.current = `CONTINUUM_LAST_WORKSPACE_V1:${actor.actorId}`;
    setRecoverableImport(null);
    setSession(actor);
    store.current = new DraftStore(localStorage, actor.actorId);
    try { drafts.current = store.current.load(); setPending(drafts.current.$pending || null); setFormDrafts(drafts.current.$forms || {}); setOperation(drafts.current.$operation || null); setStorageReady(true); }
    catch { drafts.current = {}; setStorageReady(false); setError('Saved drafts could not be read. Existing browser storage is preserved; writes are disabled.'); }
    const [data, interrupted] = await Promise.all([api.workspace(), readImport(actor.actorId).catch(() => null)]);
    if (generation !== epoch.current) return;
    setDescriptor(data); setRecoverableImport(interrupted || null);
    const repositories = formatRepositories(data);
    let saved;
    try { saved = JSON.parse(localStorage.getItem(workspacePreferenceKey.current)); } catch { /* Start with the first available workspace. */ }
    const chosen = returningSelection(data.repositories, saved);
    const activeRepo = repositories.find(repo => repo.id === chosen?.repositoryId);
    setState(s => ({ ...initialServiceState(), activeModule: s.activeModule, repositories, activeUserId: actor.actorId,
      teamMembers: [{ id: actor.actorId, name: actor.displayName, shortName: actor.displayName, initials: actor.displayName.slice(0, 2).toUpperCase(), authority: activeRepo?.role === 'reviewer' ? 'Authorized Reviewer' : 'Read-Only Viewer' }] }));
    if (chosen) await loadWorkspace(chosen, true);
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
    const currentSelection = selectionRef.current || selection;
    const currentViewId = repoViewRef.current || repositoryViewId;
    const currentWorkspace = workspaceRef.current || workspace;
    if (!currentSelection || !currentViewId || !currentWorkspace) return;
    setDetail(null); setError('');
    setState(s => ({ ...s, selectedArtifactId: contextId, inspectorOpen: true }));
    try {
      const view = await api.query(currentSelection.repositoryId, 'open_review_view', { repositoryViewId: currentViewId, snapshotId: currentWorkspace.snapshot.id, contextId });
      const [context, history] = await Promise.all([api.context(currentSelection.repositoryId, contextId, view.viewId, undefined, { includeExcerpts: true }), api.history(currentSelection.repositoryId, contextId, view.viewId)]);
      const versions = [...new Set([
        context.assertion.source.versionId,
        context.assertion.target.versionId,
        context.assertion.source.priorVersionId,
        context.assertion.target.priorVersionId,
      ].filter(Boolean))];
      const sources = await Promise.all(versions.map(id => api.version(currentSelection.repositoryId, id)));
      const evidence = context.evidence;
      if (generation !== epoch.current) return;
      const data = { ...context, history, sources, evidence };
      setDetail(data); setDraft({ ...emptyDraft(), ...drafts.current[draftKey(currentSelection, data)] });
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
      const [detailContext, history, sources] = await Promise.all([api.context(selection.repositoryId, impact.baseContextId, context.viewId, undefined, { includeExcerpts: true }), api.history(selection.repositoryId, impact.baseContextId, context.viewId), Promise.all([...new Set([context.assertion.source.versionId, context.assertion.target.versionId].filter(Boolean))].map(id => api.version(selection.repositoryId, id)))]);
      if (generation === epoch.current) setDetail({ ...context, evidence: detailContext.evidence, history, sources, returnContextId });
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
      setNotice(commandNotice(envelope));
      if (envelope.command !== 'export_snapshot' && selection?.repositoryId === envelope.repositoryId) {
        await loadWorkspace(response.result.selection || selection);
        if (envelope.command === 'correct_assertion' && response.result?.successorProjection?.contextId) {
          await selectArtifact(response.result.successorProjection.contextId);
        }
      }
      return response;
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 401) {
        const next = { ...drafts.current }; delete next.$pending;
        try { persist(next); setPending(null); } catch { /* Retain original request if storage failed. */ }
      }
      report(e);
    } finally { lock.current = false; setBusy(false); }
  }
  async function selectNextOpen(afterContextId = detail?.projection?.contextId) {
    const allRows = reviewRows(workspaceRef.current || workspace);
    const openRows = allRows.filter(r => r.projection.resolution === 'open' && r.id !== afterContextId);
    if (!openRows.length) return;
    const staleOpen = openRows.filter(r => r.projection.validity === 'stale');
    const pool = staleOpen.length ? staleOpen : openRows;
    const currentIdx = allRows.findIndex(r => r.id === afterContextId);
    const nextRow = pool.find(r => allRows.findIndex(x => x.id === r.id) > currentIdx) || pool[0];
    if (nextRow) await selectArtifact(nextRow.id);
  }
  async function saveJudgment(andAdvance = false) {
    const currentId = detail?.projection?.contextId;
    try {
      const response = await submit(contextEnvelope(selection, detail, 'record_judgment', judgmentInput(detail, draft)), draftKey(selection, detail));
      if (response && andAdvance === true) await selectNextOpen(currentId);
    } catch (e) { report(e); }
  }
  async function triageCandidate(row, disposition, note = null, andAdvance = false) {
    const currentSelection = selectionRef.current || selection;
    const currentViewId = repoViewRef.current || repositoryViewId;
    const currentWorkspace = workspaceRef.current || workspace;
    if (!row || !currentSelection || !currentViewId || !currentWorkspace || lock.current) return null;
    if (pending) { report(new Error('Resolve the retained request before submitting another command.')); return null; }
    const targetId = row.projection.contextId;
    const wasInspecting = detail?.projection?.contextId === targetId;
    try {
      const view = await api.query(currentSelection.repositoryId, 'open_review_view', {
        repositoryViewId: currentViewId, snapshotId: currentWorkspace.snapshot.id, contextId: targetId,
      });
      const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null;
      const envelope = contextEnvelope(currentSelection, { viewId: view.viewId }, 'triage_candidate', {
        contextId: targetId,
        assertionRevisionId: row.projection.assertionRevisionId,
        expectedProjectionVersion: row.projection.projectionVersion,
        disposition,
        note: trimmedNote,
      });
      const res = await submit(envelope, draftKey(currentSelection, row));
      if (res) {
        if (andAdvance) await selectNextOpen(targetId);
        else if (wasInspecting) await selectArtifact(targetId);
      }
      return res;
    } catch (e) { report(e); return null; }
  }
  const quickReject = row => triageCandidate(row, 'screen', null);
  async function loadBatchEvidence(targetRows, signal) {
    const currentSelection = selectionRef.current || selection;
    const currentViewId = repoViewRef.current || repositoryViewId;
    const currentWorkspace = workspaceRef.current || workspace;
    if (!currentSelection || !currentViewId || !currentWorkspace) return [];
    const results = [];
    for (const row of targetRows) {
      const view = await api.query(currentSelection.repositoryId, 'open_review_view', {
        repositoryViewId: currentViewId, snapshotId: currentWorkspace.snapshot.id, contextId: row.projection.contextId,
      }, signal);
      const context = await api.context(currentSelection.repositoryId, row.projection.contextId, view.viewId, signal, { includeExcerpts: true });
      const evidence = context.evidence.slice(0, 3);
      results.push({ row, viewId: view.viewId, totalEvidence: context.evidence.length, evidenceIds: context.evidence.map(e => e.id), evidence });
    }
    return results;
  }
  async function submitBatchContextCommands(targetRows, { label, buildCommand }) {
    const currentSelection = selectionRef.current || selection;
    const currentViewId = repoViewRef.current || repositoryViewId;
    const currentWorkspace = workspaceRef.current || workspace;
    if (lock.current || !currentSelection || !currentViewId || !currentWorkspace || !targetRows.length) return { succeeded: 0, failed: [] };
    if (pending) { report(new Error('Resolve the retained request before submitting another command.')); return { succeeded: 0, failed: [] }; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    let succeeded = 0;
    const failed = [];
    try {
      let activeRepoViewId = currentViewId;
      let activeSnapshotId = currentWorkspace.snapshot.id;
      for (let i = 0; i < targetRows.length; i += 1) {
        const item = targetRows[i];
        const row = item.row || item;
        setNotice(`Saving ${label} ${i + 1} of ${targetRows.length}…`);
        try {
          if (succeeded > 0) {
            const fresh = await api.query(currentSelection.repositoryId, 'select_context', currentSelection);
            activeRepoViewId = fresh.repositoryViewId;
            activeSnapshotId = fresh.snapshot.id;
          }
          const view = await api.query(currentSelection.repositoryId, 'open_review_view', {
            repositoryViewId: activeRepoViewId, snapshotId: activeSnapshotId, contextId: row.projection.contextId,
          });
          const { command, input } = buildCommand(item, row);
          const envelope = contextEnvelope(currentSelection, { viewId: view.viewId }, command, input);
          await api.command(envelope);
          const next = { ...drafts.current };
          delete next[draftKey(currentSelection, row)];
          try { persist(next); } catch { /* Keep memory state if draft storage unavailable */ }
          succeeded += 1;
        } catch (e) {
          if (e.status === 401) { report(e); return { succeeded, failed }; }
          failed.push({ id: row.id || row.projection.contextId, label: `${row.sourceLabel || row.sourcePath} → ${row.targetLabel || row.targetPath}`, message: e.message });
        }
      }
      if (succeeded > 0) await loadWorkspace(currentSelection);
      if (succeeded > 0) setNotice(`Recorded ${succeeded} ${label}${succeeded === 1 ? '' : 's'}${failed.length ? `; ${failed.length} failed` : ''}.`);
      if (failed.length) setError(`${failed.length} item${failed.length === 1 ? '' : 's'} could not be saved: ${failed[0].message}`);
      return { succeeded, failed };
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submitBatchJudgments(targetRows, { decision, reason = '' }) {
    return submitBatchContextCommands(targetRows, {
      label: `${decision} judgment`,
      buildCommand: (item, row) => ({
        command: 'record_judgment',
        input: {
          contextId: row.projection.contextId,
          assertionRevisionId: row.projection.assertionRevisionId,
          expectedProjectionVersion: row.projection.projectionVersion,
          decision,
          reason: reason.trim() ? reason : null,
          reviewedEvidenceIds: decision === 'confirm' ? (item.evidenceIds || row.assertion.evidenceIds) : [],
          contentConcern: null,
          followUpDisposition: { kind: 'none' },
        },
      }),
    });
  }
  async function submitBatchTriage(targetRows, { disposition, note = null }) {
    const trimmed = typeof note === 'string' && note.trim() ? note.trim() : null;
    return submitBatchContextCommands(targetRows, {
      label: `${disposition} triage`,
      buildCommand: (_item, row) => ({
        command: 'triage_candidate',
        input: {
          contextId: row.projection.contextId,
          assertionRevisionId: row.projection.assertionRevisionId,
          expectedProjectionVersion: row.projection.projectionVersion,
          disposition,
          note: trimmed,
        },
      }),
    });
  }
  async function importWorkspace(entry, retry = false) {
    if (lock.current || !session || entry.actorId !== session.actorId) return null;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const accountStore = store.current;
    let admitted = false;
    try {
      if (!retry) {
        try {
          await rememberImport(entry);
        } catch (e) {
          const previous = await readImport(entry.actorId);
          if (!previous) throw e;
          setRecoverableImport(previous);
          throw new Error('Resume your previous import before starting another one.');
        }
      }
      setRecoverableImport(entry);
      const response = entry.repositoryId
        ? await api.addRevision(entry.repositoryId, entry.payload)
        : await api.createWorkspace(entry.payload);
      admitted = true;
      const result = response.result;
      const nextDescriptor = await api.workspace();
      if (store.current !== accountStore) return null;
      setDescriptor(nextDescriptor);
      setState(s => ({ ...s, repositories: formatRepositories(nextDescriptor), activeModule: 'dashboard' }));
      if (!await loadWorkspace(result.selection)) return null;
      await clearImport(entry);
      setRecoverableImport(null);
      setNotice(entry.repositoryId
        ? `Revision added to "${result.name}". Check repository progress for capture status.`
        : `Workspace "${result.name}" created. Check repository progress for capture status.`);
      return result;
    } catch (e) {
      if (store.current !== accountStore) return null;
      if (!admitted && e.status >= 400 && e.status < 500 && e.status !== 401) {
        await clearImport(entry);
        setRecoverableImport(null);
      }
      report(e);
      return null;
    } finally {
      lock.current = false; setBusy(false);
    }
  }
  function startImport(repositoryId, payload, runDiscovery) {
    return importWorkspace({ actorId: session.actorId, repositoryId,
      payload: { schemaVersion: '0.1.0', requestId: crypto.randomUUID(), ...payload, runDiscovery } });
  }

  const processing = workspace?.progress?.operations?.find(op => ['queued', 'running'].includes(op.status));
  const processingId = processing?.id;
  const behindCurrent = workspace?.mode === 'historical' && followLive;
  useEffect(() => {
    if (!followLive || !session || !workspace || (!processingId && !behindCurrent)) return;
    let cancelled = false;
    let timer;
    const abort = new AbortController();
    const selected = selectionRef.current;
    const snapshotId = workspace.snapshot.id;
    const repoId = selected.repositoryId;
    const isCurrent = () => !cancelled && selectionRef.current === selected && workspaceRef.current?.snapshot.id === snapshotId;
    async function refreshProgress() {
      try {
        if (!isCurrent()) return;
        if (processingId && !behindCurrent) {
          const op = await api.query(repoId, 'read_operation', { operationId: processingId }, abort.signal);
          if (['queued', 'running'].includes(op.status)) return;
        }
        const latest = await api.query(repoId, 'read_snapshot', { selection: selected }, abort.signal);
        const [data, retained] = await Promise.all([
          api.query(repoId, 'read_workspace', { snapshotId: latest.id }, abort.signal),
          api.query(repoId, 'list_snapshots', { repositoryViewId: repoViewRef.current }, abort.signal),
        ]);
        if (!isCurrent()) return;
        workspaceRef.current = data; setWorkspace(data); setRetainedSnapshots(retained.items);
      } catch (e) {
        if (isCurrent() && e.status && e.status < 500) {
          cancelled = true;
          report(e);
          return;
        }
      } finally {
        if (isCurrent() && !abort.signal.aborted) timer = setTimeout(refreshProgress, 1500);
      }
    }
    timer = setTimeout(refreshProgress, behindCurrent ? 0 : 700);
    return () => { cancelled = true; clearTimeout(timer); abort.abort(); };
  }, [api, session, workspace, followLive, processingId, behindCurrent]);

  const activeRepository = descriptor?.repositories.find(r => r.id === state.activeRepoId);
  const canWrite = activeRepository?.role === 'reviewer' && workspace?.mode === 'active' && storageReady && !pending;
  const rows = reviewRows(workspace);
  const value = { serviceMode: true, api, session, checking, signIn, signOut, state, setState, descriptor, selection, repositoryViewId, workspace, detail, draft, updateDraft,
    rows, openPriorDecision, loadMoreHistory, selectNextOpen, quickReject, triageCandidate, loadBatchEvidence, submitBatchJudgments, submitBatchTriage, openSource: artifactId => { setState(s => ({ ...s, activeModule: 'files', sourceArtifactId: artifactId, inspectorOpen: false })); setCommandPaletteOpen(false); }, error, notice, busy, canWrite, pending, report, submit, saveJudgment,
    createCustomWorkspace: (payload, { runDiscovery = true } = {}) => startImport(null, payload, runDiscovery),
    addCustomRevision: (repositoryId, payload, { runDiscovery = false } = {}) => startImport(repositoryId, payload, runDiscovery),
    recoverableImport, resumeImport: () => recoverableImport && importWorkspace(recoverableImport, true),
    workspaceModalMode, openWorkspaceModal: (mode = 'create') => setWorkspaceModalMode(mode), closeWorkspaceModal: () => setWorkspaceModalMode(null),
    relationshipSeed, setRelationshipSeed, openNewRelationshipWithSeed: seed => {
      if (seed?.artifact && selection) {
        const art = seed.artifact;
        const inferredType = art.kind === 'code' ? 'implements' : art.kind === 'decision' ? 'motivates' : 'documents';
        const anchorSide = art.kind === 'code' && inferredType === 'documents' ? 'target' : 'source';
        const key = JSON.stringify(['relationship', 'new', selection.repositoryId, selection.targetRevision.commitId, selection.comparisonId || null]);
        const existing = formDrafts[key] || { type: 'documents', source: '', target: '', reason: '', anchor: 'source', start: 1, end: 1, newAnchor: false };
        const nextDraft = {
          ...existing,
          type: inferredType,
          ...(anchorSide === 'source' ? { source: art.artifactId } : { target: art.artifactId }),
          anchor: anchorSide,
          start: seed.startLine || 1,
          end: seed.endLine || seed.startLine || 1,
        };
        const nextForms = { ...formDrafts, [key]: nextDraft };
        try { persist({ ...drafts.current, $forms: nextForms }); setFormDrafts(nextForms); } catch (e) { report(e); }
      }
      setRelationshipSeed(Boolean(seed));
      setState(s => ({ ...s, activeModule: 'changes' }));
    },
    modalSeed, openRecordWithSeed: seed => { setModalSeed(seed || null); setModalOpen(true); },
    submitRecordIntent: async ({ recordInput, linkSpec = null, draftKey: formDraftKey = null }) => {
      const activeSelection = selectionRef.current || selection;
      const activeViewId = repoViewRef.current || repositoryViewId;
      if (!activeSelection || !activeViewId) return null;
      const recRes = await submit(
        contextEnvelope(activeSelection, { viewId: activeViewId }, 'capture_record', recordInput),
        linkSpec ? null : formDraftKey
      );
      if (!recRes?.result?.artifactId) return null;
      if (!linkSpec) return recRes;
      const created = recRes.result;
      const freshSelection = selectionRef.current || activeSelection;
      const freshViewId = repoViewRef.current || activeViewId;
      const isDecision = recordInput.kind === 'decision';
      const endpoints = isDecision
        ? {
            type: 'motivates',
            sourceArtifactId: created.artifactId,
            sourceVersionId: created.artifactVersionId,
            targetArtifactId: linkSpec.target.artifactId,
            targetVersionId: linkSpec.target.versionId,
          }
        : {
            type: 'implements',
            sourceArtifactId: linkSpec.target.artifactId,
            sourceVersionId: linkSpec.target.versionId,
            targetArtifactId: created.artifactId,
            targetVersionId: created.artifactVersionId,
          };
      const evidenceAnchor = linkSpec.evidenceOn === 'record'
        ? { artifactVersionId: created.artifactVersionId, locator: { kind: 'lines', startLine: 1, endLine: 1 } }
        : {
            artifactVersionId: linkSpec.target.versionId,
            locator: { kind: 'lines', startLine: Number(linkSpec.startLine || 1), endLine: Number(linkSpec.endLine || 1) },
          };
      const candRes = await submit(
        contextEnvelope(freshSelection, { viewId: freshViewId }, 'capture_candidate', {
          ...endpoints,
          targetRevision: freshSelection.targetRevision,
          evidence: [evidenceAnchor],
          reason: linkSpec.reason,
          predecessorContextId: null,
        }),
        formDraftKey
      );
      return candRes || recRes;
    },
    retryPending: () => pending && submit(pending.envelope, pending.draftKey),
    refresh: () => selection && loadWorkspace(selection),
    retainedSnapshots, openSnapshot: async snapshotId => {
      setFollowLive(false);
      const generation = ++epoch.current; setDetail(null); setError(''); setBusy(true); setState(s => ({ ...s, inspectorOpen: false }));
      try { const data = await api.query(selection.repositoryId, 'read_workspace', { snapshotId }); if (generation === epoch.current) { workspaceRef.current = data; setWorkspace(data); } }
      catch (e) { if (generation === epoch.current) report(e); }
      finally { if (generation === epoch.current) setBusy(false); }
    },
    formDrafts, saveFormDraft: (key, data) => { try { const next = { ...formDrafts, [key]: data }; persist({ ...drafts.current, $forms: next }); setFormDrafts(next); } catch (e) { report(e); } },
    operation, checkOperation: async () => {
      if (lock.current || !operation) return;
      const target = operation;
      setBusy(true);
      try { const result = await api.query(target.repositoryId, 'read_operation', { operationId: target.operationId });
        if (drafts.current.$operation?.operationId && drafts.current.$operation.operationId !== target.operationId) return;
        const next = { ...target, ...result }; persist({ ...drafts.current, $operation: next }); setOperation(next);
        if (selection?.repositoryId === target.repositoryId) await loadWorkspace(selection);
      } catch (e) { report(e); }
      finally { setBusy(false); }
    },
    changeSelection: chosen => { if (!lock.current) loadWorkspace(chosen); },
    handleSwitchRepo: id => { const chosen = chooseSelection(descriptor.repositories.find(r => r.id === id)); if (chosen) loadWorkspace(chosen); },
    selectArtifact, closeInspector: () => { ++epoch.current; setDetail(null); setState(s => ({ ...s, inspectorOpen: false })); },
    switchModule: (activeModule, opts = null) => {
      if (!busy) setNotice('');
      setState(s => ({ ...s, activeModule, ...(opts?.queueTab ? { queueTab: opts.queueTab } : {}) }));
    },
    dismissNotice: () => setNotice(''),
    staleCount: workspace?.snapshot?.staleReviewCount ?? rows.filter(r => r.projection.validity === 'stale' && r.projection.resolution === 'open').length,
    pendingCount: workspace?.snapshot.pendingReviewCount || 0, theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    modalOpen, openModal: () => { setModalSeed(null); setModalOpen(true); }, closeModal: () => { setModalOpen(false); setModalSeed(null); },
    isCommandPaletteOpen, setCommandPaletteOpen, openCommandPalette: () => setCommandPaletteOpen(true), closeCommandPalette: () => setCommandPaletteOpen(false),
  };
  return <ContinuumContext.Provider value={value}>{children}</ContinuumContext.Provider>;
}
