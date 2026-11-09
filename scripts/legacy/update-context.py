from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
p = (PROJECT_ROOT / 'apps/web/src/context/ContinuumContext.jsx')
s = p.read_text(encoding='utf-8-sig')
s = s.replace("import { loadState, saveState, CHANGE_NEIGHBOR_IDS, createInitialState }", "import { loadState, saveState, createInitialState }")
s = s.replace("const ContinuumContext", "import { commitReview, reviewError, pendingItems, undoCommittedReview, REVIEW_IDS } from '../data/workflow.js';\n\nconst ContinuumContext", 1)
s = s.replace("const [toast, setToast]", "const [session, setSession] = useState(() => {\n    try { return JSON.parse(sessionStorage.getItem('CONTINUUM_DEMO_SESSION') || 'null'); } catch { return null; }\n  });\n  const [toast, setToast]", 1)
s = s.replace("setState(s => ({ ...s, activeModule: mod }));", "setState(s => ({ ...s, activeModule: mod, inspectorOpen: false, reviewFormOpen: false, reviewError: '' }));")
s = s.replace("inspectorOpen: true, reviewFormOpen: false };", "inspectorOpen: true, inspectorTab: 'reading', reviewFormOpen: false, reviewError: '', lastSavedReview: null };")
s = s.replace("const openReviewForm = useCallback(() => setState(s => ({ ...s, reviewFormOpen: true })), [setState]);", "const openReviewForm = useCallback(() => setState(s => ({ ...s, reviewFormOpen: true, reviewError: '', lastSavedReview: null })), [setState]);")
start = s.index('  const saveJudgment = useCallback(')
end = s.index('  const undoReview = useCallback(', start)
s = s[:start] + '''  const saveJudgment = useCallback(() => {
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

''' + s[end:]
s = s.replace("if (!isAuthorized()) {\n      showToast('Active persona is Read-Only and cannot undo reviews.');", "if (!isAuthorized() || state.revisionMode !== 'R1') {\n      showToast('Use an authorized reviewer in R1 to reopen a judgment.');")
s = s.replace("a.draftIsAi = false;\n      return { ...s, artifacts: { ...s.artifacts, [artId]: a }, reviewFormOpen: true };", "a.draftIsAi = false;\n      if (a.relKind === 'candidate') { a.coverageCondition = 'candidate'; a.coverageBadge = 'Candidate Only'; }\n      return { ...s, artifacts: { ...s.artifacts, [artId]: a }, reviewFormOpen: true, lastSavedReview: null };")
s = s.replace("state.artifacts]);", "state.artifacts, state.revisionMode]);")
s = s.replace("setState(s => ({ ...s, activeRepoId: repoId }));", "if (repoId !== 'repo-checkout') { showToast('This demo contains review evidence for core/checkout-service only.'); return; }\n    setState(s => ({ ...s, activeRepoId: repoId, inspectorOpen: false }));")
s = s.replace("activeModule: targetModule\n", "activeModule: targetModule, onboardingComplete: true, revisionMode: 'R1', inspectorOpen: false, reviewFormOpen: false\n")
s = s.replace("`Successfully ingested ${repo?.fullName || 'repository'} · Synced to Neo4j.`", "`Demo workspace ready: ${repo?.fullName || 'repository'}. No remote repository was accessed.`")
# Add session actions after all hooks they reference are declared.
start = s.index('  // Pending count for nav badge')
end = s.index('  const value = {', start)
s = s[:start] + '''  const signIn = useCallback((profile) => {
    const next = { name: profile.name, email: profile.email, signedInAt: new Date().toISOString() };
    sessionStorage.setItem('CONTINUUM_DEMO_SESSION', JSON.stringify(next));
    setSession(next);
    setState(s => ({ ...s, activeUserId: profile.viewer ? 'user-sam' : 'user-jc', activeRepoId: 'repo-checkout', activeModule: 'dashboard', inspectorOpen: false, reviewFormOpen: false, reviewError: '', lastSavedReview: null }));
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

''' + s[end:]
s = s.replace('    state,\n    setState,\n    resetState,', '    state,\n    setState,\n    session, signIn, signOut, reviewNext, resolveFollowUp,\n    resetState,')
# Keep authored decisions separate from the seeded DEC-04 record.
start = s.index("      const dec = { ...s.artifacts['DEC-04'] };")
end = s.index('\n    });\n    closeModal();', start)
s = s[:start] + '''      const id = `INT-${crypto.randomUUID().slice(0, 8)}`;
      const decision = { id, name: title, shortName: `${id} :: ${title}`, category: 'Decisions', file: targetId,
        relKind: 'decision', relLabel: 'Recorded intent', plainReason: rationale, linkedIntentId: targetId,
        r1Status: 'reviewed', judgmentChoice: 'Authored intent', followUpWork: 'No edit needed', savedRationale: rationale,
        r1Reviewer: user.shortName, r1ReviewedAt: new Date().toLocaleString(), historyR0: [],
        provenanceMethod: 'Human-authored demo record', provenanceAnchor: targetId, provenanceScore: 'Direct intent', provenanceNote: 'Stored locally in this browser.',
        codeExcerptR0: [], codeExcerptR1: [{ ln: 1, text: title }, { ln: 2, text: rationale }] };
      return { ...s, artifacts: { ...s.artifacts, [id]: decision }, activityLog: [{ ...newLog, id, artifactId: id, detail: rationale }, ...s.activityLog], selectedArtifactId: id, inspectorOpen: true, inspectorTab: 'reading', reviewFormOpen: false };
''' + s[end:]
s = s.replace('undoCommittedReview, REVIEW_IDS', 'undoCommittedReview')
p.write_text(s, encoding='utf-8')
