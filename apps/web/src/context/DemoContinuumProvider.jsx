/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { toast as sonnerToast } from 'sonner';
import { loadState, saveState, createInitialState } from '../data/state.js';

import { commitReview, reviewError, pendingItems, undoCommittedReview } from '../data/workflow.js';

import { ContinuumContext } from './ContinuumBase.js';
export default function DemoContinuumProvider({ children }) {
  const [state, setStateRaw] = useState(() => loadState());
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('CONTINUUM_DEMO_SESSION') || 'null'); } catch { return null; }
  });
  const [toast, setToast] = useState(null); // { msg, undo }
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return 'light';
  });
  const toastTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('CONTINUUM_THEME', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // One-time self-healing migration: strip robotic '::' and humanize R0/R1 in browser memory/localStorage
  useEffect(() => {
    setStateRaw(prev => {
      let changed = false;
      const nextArtifacts = { ...prev.artifacts };
      Object.keys(nextArtifacts).forEach(k => {
        const art = nextArtifacts[k];
        if (!art) return;
        let artChanged = false;
        let newShortName = art.shortName;
        let newJudgment = art.judgmentChoice;
        if (newShortName?.includes(' :: ')) {
          newShortName = newShortName.replace(/ :: /g, ' · ');
          artChanged = true;
        }
        if (newJudgment === 'Confirm valid at R1') {
          newJudgment = 'Confirm valid with change';
          artChanged = true;
        }
        if (artChanged) {
          nextArtifacts[k] = {
            ...art,
            shortName: newShortName,
            judgmentChoice: newJudgment
          };
          changed = true;
        }
      });
      const nextLogs = (prev.activityLog || []).map(log => {
        if (log.badge?.includes('R1') || log.badge?.includes('R0') || log.action?.includes('at R1')) {
          changed = true;
          return {
            ...log,
            action: log.action ? log.action.replace(' at R1', ' with change').replace(' :: ', ' · ') : log.action,
            badge: log.badge ? log.badge.replace('Reviewed at R1', 'Reviewed with change').replace('Historical R0', 'Baseline') : log.badge
          };
        }
        return log;
      });
      if (changed) {
        const next = { ...prev, artifacts: nextArtifacts, activityLog: nextLogs };
        saveState(next);
        return next;
      }
      return prev;
    });
  }, []);

  const triggerConfetti = useCallback((options = {}) => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        ...options
      });
    } catch {
      // safe fallback
    }
  }, []);

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  }, []);

  // Toast helpers
  const showToast = useCallback((msg, undoOrType = null) => {
    clearTimeout(toastTimerRef.current);
    const isUndoFn = typeof undoOrType === 'function';
    const undo = isUndoFn ? undoOrType : null;
    setToast({ msg, undo });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);

    // Sonner toast dispatch
    if (isUndoFn) {
      sonnerToast(msg, {
        action: {
          label: 'Undo',
          onClick: () => undo()
        },
        duration: 5000
      });
    } else if (undoOrType === 'success') {
      sonnerToast.success(msg, { duration: 4000 });
    } else if (undoOrType === 'error') {
      sonnerToast.error(msg, { duration: 4000 });
    } else {
      sonnerToast(msg, { duration: 4000 });
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setCommandPaletteOpen(p => !p), []);

  const resetState = useCallback(() => {
    const fresh = createInitialState();
    setStateRaw(fresh);
    saveState(fresh);
    showToast('Reset repository context back to clean baseline.');
  }, [showToast]);

  // Selectors
  const getActiveUser = useCallback(() => {
    return state.teamMembers?.find(m => m.id === state.activeUserId) || state.teamMembers?.[0];
  }, [state.teamMembers, state.activeUserId]);

  const isAuthorized = useCallback(() => {
    return getActiveUser()?.authority === 'Authorized Reviewer';
  }, [getActiveUser]);

  // Navigation
  const switchModule = useCallback((mod) => {
    setState(s => ({ ...s, activeModule: mod, inspectorOpen: false, reviewFormOpen: false, reviewError: '' }));
  }, [setState]);

  const toggleRevisionMode = useCallback(() => {
    setState(s => {
      const next = s.revisionMode === 'R1' ? 'R0' : 'R1';
      showToast(next === 'R1'
        ? 'Switched to Incoming Change (8f3b21d).'
        : 'Switched to Historical Baseline (a41c90e).');
      return { ...s, revisionMode: next, reviewFormOpen: false };
    });
  }, [setState, showToast]);

  const switchActiveUser = useCallback((userId) => {
    setState(s => {
      const u = s.teamMembers?.find(m => m.id === userId);
      showToast(`Active persona switched to ${u?.name || userId} (${u?.authority}).`);
      return { ...s, activeUserId: userId };
    });
  }, [setState, showToast]);

  // Artifact selection â€” opens inspector
  const selectArtifact = useCallback((id) => {
    setState(s => {
      if (!s.artifacts[id]) return s;
      return { ...s, selectedArtifactId: id, inspectorOpen: true, inspectorTab: 'reading', reviewFormOpen: false, reviewError: '', lastSavedReview: null };
    });
  }, [setState]);

  // Inspector actions
  const closeInspector = useCallback(() => setState(s => ({ ...s, inspectorOpen: false })), [setState]);
  const switchInspectorTab = useCallback((tab) => setState(s => ({ ...s, inspectorTab: tab })), [setState]);
  const openReviewForm = useCallback(() => setState(s => ({ ...s, reviewFormOpen: true, reviewError: '', lastSavedReview: null })), [setState]);
  const closeReviewForm = useCallback(() => setState(s => ({ ...s, reviewFormOpen: false })), [setState]);

  const setFormJudgmentChoice = useCallback((choice) => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId] };
      art.judgmentChoice = choice;
      if (choice === 'Keep link Â· Flag content issue' && art.category === 'Documentation') {
        art.followUpWork = 'Doc update deferred';
      }
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const setFormFollowUpWork = useCallback((work) => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId], followUpWork: work };
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const handleRationaleInput = useCallback((val) => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId], draftRationale: val };
      if (art.draftIsAi && val.trim()) art.draftIsAi = false;
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const reuseDec04Rationale = useCallback(() => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId] };
      if (art.id === 'aaa.py::submitUserOrder') {
        art.judgmentChoice = 'Confirm valid at R1';
        art.followUpWork = 'Code update open';
        art.draftRationale = 'Per DEC-04, createRequest() now returns {"id": req_id, "status": "PENDING"}. submitUserOrder() slices the return value as a string at line 23 and requires a caller update to read req_id["id"].';
      } else if (art.id === 'REQ-02') {
        art.judgmentChoice = 'Confirm valid at R1';
        art.followUpWork = 'No edit needed';
        art.draftRationale = 'Per DEC-04, createRequest() now synchronously returns both the unique request ID and initial "PENDING" status, fulfilling REQ-02 with no further edit needed.';
      } else {
        art.draftRationale = `Verified against DEC-04 (${s.decisionHeadline.title}): relationship inspected at R1 (8f3b21d).`;
      }
      art.draftIsAi = false;
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const suggestAiDraft = useCallback(() => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId] };
      art.draftRationale = `[AI Draft from Baseline → Change Diff]: ${art.plainReason}`;
      art.draftIsAi = true;
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const confirmAiDraft = useCallback(() => {
    setState(s => {
      const art = { ...s.artifacts[s.selectedArtifactId] };
      art.draftIsAi = false;
      art.draftRationale = art.draftRationale.replace(/^\[AI Draft from (?:R0[→\u2192]R1|Baseline\s*→\s*Change) Diff\]:\s*/, '');
      return { ...s, artifacts: { ...s.artifacts, [s.selectedArtifactId]: art } };
    });
  }, [setState]);

  const saveJudgment = useCallback(() => {
    const id = state.selectedArtifactId;
    const error = reviewError(state, id);
    if (error) { setState(s => ({ ...s, reviewError: error })); showToast(error, 'error'); return; }
    const original = structuredClone(state.artifacts[id]);
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toLocaleString();
    setState(s => commitReview(s, id, timestamp, eventId));
    showToast(`Judgment saved for ${original.shortName}.`, () => {
      setState(s => undoCommittedReview(s, original, eventId));
    });
  }, [state, setState, showToast]);

  const reviewNext = useCallback(() => {
    const next = pendingItems(state)[0];
    if (next) {
      setState(s => ({ ...s, selectedArtifactId: next.id, activeModule: 'changes', inspectorOpen: true, inspectorTab: 'reading', reviewFormOpen: false, lastSavedReview: null, reviewError: '' }));
    } else {
      setState(s => ({ ...s, activeModule: 'summary', inspectorOpen: false, reviewFormOpen: false, lastSavedReview: null }));
    }
  }, [state, setState]);

  const resolveFollowUp = useCallback((id, note) => {
    if (!isAuthorized() || state.revisionMode !== 'R1' || !note.trim()) return;
    setState(s => {
      const art = s.artifacts[id];
      if (!art || art.r1Status !== 'reviewed') return s;
      const record = { id: crypto.randomUUID(), actor: getActiveUser().shortName, time: new Date().toLocaleString(), action: `Recorded follow-up completion for ${art.shortName}`, detail: note.trim(), artifactId: id };
      return { ...s, artifacts: { ...s.artifacts, [id]: { ...art, followUpResolved: true, followUpResolution: note.trim() } }, activityLog: [record, ...s.activityLog] };
    });
    showToast('Follow-up completion recorded in this demo. Repository files were not modified.');
  }, [isAuthorized, state.revisionMode, getActiveUser, setState, showToast]);

  const undoReview = useCallback((artId) => {
    if (!isAuthorized() || state.revisionMode !== 'R1') {
      showToast('Use an authorized reviewer in R1 to reopen a judgment.');
      return;
    }
    setState(s => {
      const a = { ...s.artifacts[artId] };
      a.r1Status = a.id === 'docs/onboarding_notes.md' ? 'candidate' : 'needs_review';
      a.draftRationale = a.savedRationale;
      a.draftIsAi = false;
      if (a.relKind === 'candidate') { a.coverageCondition = 'candidate'; a.coverageBadge = 'Candidate Only'; }
      return { ...s, artifacts: { ...s.artifacts, [artId]: a }, reviewFormOpen: true, lastSavedReview: null };
    });
    showToast(`Reopened R1 review for ${state.artifacts[artId]?.shortName}. Draft preserved.`);
  }, [isAuthorized, setState, showToast, state.artifacts, state.revisionMode]);

  // Import Repo Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const openImportModal = useCallback(() => setImportModalOpen(true), []);
  const closeImportModal = useCallback(() => setImportModalOpen(false), []);

  const handleSwitchRepo = useCallback((repoId) => {
    if (repoId !== 'repo-checkout') { showToast('This demo contains review evidence for core/checkout-service only.'); return; }
    setState(s => ({ ...s, activeRepoId: repoId, inspectorOpen: false }));
    const repo = state.repositories?.find(r => r.id === repoId);
    showToast(`Active repository set to ${repo?.fullName || repoId}.`);
  }, [state.repositories, setState, showToast]);

  const handleImportComplete = useCallback(({ repoId, targetModule = 'dashboard' }) => {
    setState(s => ({
      ...s,
      activeRepoId: repoId || 'repo-checkout',
      activeModule: targetModule, onboardingComplete: true, revisionMode: 'R1', inspectorOpen: false, reviewFormOpen: false
    }));
    const repo = state.repositories?.find(r => r.id === repoId) || state.repositories?.[0];
    showToast(`Demo workspace ready: ${repo?.fullName || 'repository'}. No remote repository was accessed.`);
  }, [state.repositories, setState, showToast]);

  // Record Intent modal
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const openModal = useCallback(() => setIntentModalOpen(true), []);
  const closeModal = useCallback(() => setIntentModalOpen(false), []);

  // GitHub Code & Symbols Explorer modal
  const [codeExplorerOpen, setCodeExplorerOpen] = useState(false);
  const [codeExplorerFile, setCodeExplorerFile] = useState('src/bbb.py');
  const openCodeExplorer = useCallback((file = 'src/bbb.py') => {
    setCodeExplorerFile(file);
    setCodeExplorerOpen(true);
  }, []);
  const closeCodeExplorer = useCallback(() => setCodeExplorerOpen(false), []);

  const handleRecordIntent = useCallback(({ kind, targetId, title, rationale }) => {
    if (!isAuthorized()) {
      showToast('Read-Only persona cannot record new decisions. Switch to an Authorized Reviewer.');
      return;
    }
    const user = getActiveUser();
    setState(s => {
      const newLog = {
        time: 'Just now',
        actor: user.shortName,
        action: `Recorded ${kind} linked directly to ${targetId}`,
        detail: title,
        artifactId: targetId,
        badge: 'Direct Intent'
      };
      const id = `INT-${crypto.randomUUID().slice(0, 8)}`;
      const decision = { id, name: title, shortName: `${id} — ${title}`, category: 'Decisions', file: targetId,
        relKind: 'decision', relLabel: 'Recorded intent', plainReason: rationale, linkedIntentId: targetId,
        r1Status: 'reviewed', judgmentChoice: 'Authored intent', followUpWork: 'No edit needed', savedRationale: rationale,
        r1Reviewer: user.shortName, r1ReviewedAt: new Date().toLocaleString(), historyR0: [],
        provenanceMethod: 'Human-authored demo record', provenanceAnchor: targetId, provenanceScore: 'Direct intent', provenanceNote: 'Stored locally in this browser.',
        codeExcerptR0: [], codeExcerptR1: [{ ln: 1, text: title }, { ln: 2, text: rationale }] };
      return { ...s, artifacts: { ...s.artifacts, [id]: decision }, activityLog: [{ ...newLog, id, artifactId: id, detail: rationale }, ...s.activityLog], selectedArtifactId: id, inspectorOpen: true, inspectorTab: 'reading', reviewFormOpen: false };

    });
    closeModal();
    showToast(`Recorded ${kind} ("${title}") and linked it to ${targetId}.`);
  }, [isAuthorized, getActiveUser, setState, closeModal, showToast]);

  const signIn = useCallback((profile) => {
    const next = { name: profile.name, email: profile.email, signedInAt: new Date().toISOString() };
    sessionStorage.setItem('CONTINUUM_DEMO_SESSION', JSON.stringify(next));
    setSession(next);
    setState(s => ({ ...s, activeUserId: profile.viewer ? 'user-sr' : 'user-jc', activeRepoId: 'repo-checkout', activeModule: 'dashboard', inspectorOpen: false, reviewFormOpen: false, reviewError: '', lastSavedReview: null }));
  }, [setState]);
  const signOut = useCallback(() => {
    sessionStorage.removeItem('CONTINUUM_DEMO_SESSION');
    setSession(null);
    setCommandPaletteOpen(false);
    setImportModalOpen(false);
    setIntentModalOpen(false);
    setCodeExplorerOpen(false);
    hideToast();
    sonnerToast.dismiss();
    setState(s => ({ ...s, inspectorOpen: false, reviewFormOpen: false }));
  }, [setState, hideToast]);
  const pendingCount = state.revisionMode === 'R0' ? 0 : pendingItems(state).length;

  const value = {
    state,
    setState,
    session, signIn, signOut, reviewNext, resolveFollowUp,
    resetState,
    toast,
    showToast,
    hideToast,
    theme,
    toggleTheme,
    triggerConfetti,
    getActiveUser,
    isAuthorized,
    switchModule,
    toggleRevisionMode,
    switchActiveUser,
    selectArtifact,
    closeInspector,
    switchInspectorTab,
    openReviewForm,
    closeReviewForm,
    setFormJudgmentChoice,
    setFormFollowUpWork,
    handleRationaleInput,
    reuseDec04Rationale,
    suggestAiDraft,
    confirmAiDraft,
    saveJudgment,
    undoReview,
    importModalOpen,
    openImportModal,
    closeImportModal,
    handleSwitchRepo,
    handleImportComplete,
    modalOpen: intentModalOpen,
    openModal,
    closeModal,
    handleRecordIntent,
    codeExplorerOpen,
    codeExplorerFile,
    openCodeExplorer,
    closeCodeExplorer,
    pendingCount,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette
  };

  return (
    <ContinuumContext.Provider value={value}>
      {children}
    </ContinuumContext.Provider>
  );
}
