export const SERVICE_MODULES = ['dashboard', 'changes', 'files', 'explore', 'coverage', 'summary', 'account', 'governance'];

export function initialServiceState() {
  return { activeModule: 'dashboard', activeRepoId: null, selectedArtifactId: null,
    inspectorOpen: false, inspectorTab: 'reading', reviewFormOpen: false, reviewError: '',
    revisionMode: 'R1', onboardingComplete: true, artifacts: {}, repositories: [], teamMembers: [], activeUserId: null };
}

export function allSelections(repository) {
  if (!repository?.inputs?.length) return [];
  const items = [];
  for (const input of repository.inputs) {
    const profile = input.profiles?.[0];
    if (!profile) continue;
    for (const revision of input.revisions || []) {
      items.push({
        label: revision.label,
        isCustom: Boolean(input.isCustom),
        selection: {
          repositoryId: repository.id,
          targetRevision: { objectAlgorithm: revision.objectAlgorithm, commitId: revision.commitId },
          baseRevision: null,
          inventoryId: input.id,
          configurationId: profile.id,
        },
      });
    }
  }
  return items;
}

/**
 * Builds CompareDialog Baseline/Target options and picks the settled comparison
 * snapshot targeting the preceding commit (e.g. revalidated R0 -> R1 before R2)
 * when available so chained revalidations are preserved across comparisons.
 */
export function buildCompareOptions({ revisionChoices = [], capturedChoices = [], currentSelection = null, targetCommit = '' }) {
  const labelByCommit = new Map(revisionChoices.map(r => [r.selection.targetRevision.commitId, r.label]));
  const isInitCaptured = commitId =>
    capturedChoices.some(choice => !choice.selection?.baseRevision && choice.selection?.targetRevision?.commitId === commitId)
    || capturedChoices.some(choice => choice.selection?.targetRevision?.commitId === commitId);

  const initialOptions = revisionChoices.map(r => {
    const commitId = r.selection.targetRevision.commitId;
    return {
      key: `init:${commitId}`,
      kind: 'initial',
      commitId,
      selection: r.selection,
      label: `${r.label} · ${commitId.slice(0, 7)}`,
      captured: isInitCaptured(commitId),
    };
  });

  const comparisonOptions = [];
  const seenComparisonSnapshots = new Set();
  for (const choice of capturedChoices) {
    const sel = choice?.selection;
    if (!sel?.baseRevision || !choice.snapshotId || seenComparisonSnapshots.has(choice.snapshotId)) continue;
    if (targetCommit && sel.targetRevision?.commitId === targetCommit) continue;
    seenComparisonSnapshots.add(choice.snapshotId);
    const baseLbl = labelByCommit.get(sel.baseRevision.commitId) || sel.baseRevision.commitId.slice(0, 7);
    const tgtLbl = labelByCommit.get(sel.targetRevision.commitId) || sel.targetRevision.commitId.slice(0, 7);
    comparisonOptions.push({
      key: `snap:${choice.snapshotId}`,
      kind: 'comparison',
      snapshotId: choice.snapshotId,
      commitId: sel.targetRevision.commitId,
      selection: sel,
      label: `Revalidated ${baseLbl} → ${tgtLbl} · ${sel.targetRevision.commitId.slice(0, 7)}`,
      captured: true,
    });
  }

  const baselineOptions = [...comparisonOptions, ...initialOptions];
  const capturedInitials = initialOptions.filter(o => o.captured);
  const activeCommit = currentSelection?.targetRevision?.commitId || targetCommit;
  const currentIdx = capturedInitials.findIndex(o => o.commitId === activeCommit);
  const prevInitial = (currentIdx > 0
    ? capturedInitials[currentIdx - 1]
    : capturedInitials.find(o => o.commitId !== activeCommit)) || initialOptions[0];

  const comparisonForPrev = prevInitial
    ? comparisonOptions.find(c => c.commitId === prevInitial.commitId)
    : null;

  const defaultBaseKey = currentSelection?.baseRevision
    ? 'current'
    : (comparisonForPrev?.key || prevInitial?.key || '');

  return { baselineOptions, initialOptions, comparisonOptions, defaultBaseKey };
}

export function chooseSelection(repository, preferred) {
  const input = repository?.inputs.find(item => item.id === preferred?.inventoryId && item.profiles.length) || repository?.inputs.find(item => item.profiles.length);
  if (!input) return null;
  const profile = input.profiles.find(item => item.id === preferred?.configurationId) || input.profiles[0];
  const revision = input.revisions.find(item => item.commitId === preferred?.targetRevision?.commitId) || input.revisions[0];
  return { repositoryId: repository.id, targetRevision: { objectAlgorithm: revision.objectAlgorithm, commitId: revision.commitId },
    baseRevision: null, inventoryId: input.id, configurationId: profile.id };
}

export function reviewRows(workspace) {
  const artifacts = new Map((workspace?.artifacts || []).map(item => [item.artifactId, item]));
  return (workspace?.assertions || []).map(item => ({ ...item, id: item.projection.contextId,
    source: artifacts.get(item.assertion.source.artifactId), target: artifacts.get(item.assertion.target.artifactId),
    sourcePath: artifacts.get(item.assertion.source.artifactId)?.path || 'Unavailable source',
    sourceLabel: artifacts.get(item.assertion.source.artifactId)?.identity?.title || artifacts.get(item.assertion.source.artifactId)?.path || 'Unavailable source',
    targetLabel: artifacts.get(item.assertion.target.artifactId)?.identity?.title || artifacts.get(item.assertion.target.artifactId)?.path || 'Unavailable target',
    targetPath: artifacts.get(item.assertion.target.artifactId)?.path || 'Unavailable code',
  }));
}

export function permittedDecisions(projection) {
  if (projection?.resolution === 'open' && projection.validity === 'candidate') return ['confirm', 'reject'];
  if (projection?.resolution === 'open' && projection.validity === 'stale') return ['reconfirm', 'retire'];
  if (projection?.resolution === 'resolved' && projection.validity === 'confirmed') return ['retire'];
  return [];
}

export const draftKey = (selection, row) => JSON.stringify([
  selection.repositoryId, selection.comparisonId || null, selection.targetRevision.commitId, row.projection.contextId, row.assertion.id,
]);

export const emptyDraft = () => ({ decision: '', reason: '', contentConcern: '', followUpKind: 'none', followUpNote: '', independentNote: '', inspected: false });

export const optionalReason = (detail, decision) => detail?.projection.kind === 'initial'
  && !detail.projection.comparisonId && detail.projection.validity === 'candidate'
  && detail.projection.resolution === 'open' && ['confirm', 'reject'].includes(decision);
export const reasonLabel = reason => typeof reason === 'string' && reason.trim() ? reason : 'No reason provided';

export function judgmentInput(detail, draft) {
  const projection = detail.projection;
  if (detail.mode !== 'active') throw new Error('This is a retained historical view. Refresh the current workspace to write.');
  if (!permittedDecisions(projection).includes(draft.decision)) throw new Error('Choose an available relationship judgment.');
  if (!optionalReason(detail, draft.decision) && !draft.reason.trim()) throw new Error('Add a reason for the next reviewer.');
  if (['confirm', 'reconfirm'].includes(draft.decision) && !draft.inspected) throw new Error('Inspect the exact sources and evidence before confirming.');
  if (draft.followUpKind !== 'none' && !draft.followUpNote.trim()) throw new Error('Describe the independent follow-up work.');
  return { contextId: projection.contextId, assertionRevisionId: projection.assertionRevisionId,
    expectedProjectionVersion: projection.projectionVersion, decision: draft.decision, reason: draft.reason.trim() ? draft.reason : null,
    reviewedEvidenceIds: detail.evidence.map(item => item.id), contentConcern: draft.contentConcern.trim() ? draft.contentConcern : null,
    followUpDisposition: draft.followUpKind === 'none' ? { kind: 'none' } : { kind: 'open', workKind: draft.followUpKind, note: draft.followUpNote },
  };
}

export function contextEnvelope(selection, detail, command, input, requestId = crypto.randomUUID()) {
  return { schemaVersion: '0.1.0', requestId, repositoryId: selection.repositoryId, viewId: detail.viewId, command, input };
}

export class DraftStore {
  constructor(storage, actorId) {
    this.storage = storage;
    this.key = `CONTINUUM_SERVICE_DRAFTS_V1:${actorId}`;
    this.disabled = false;
  }
  load() {
    try {
      const data = JSON.parse(this.storage.getItem(this.key) || '{}');
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid draft store');
      return data;
    } catch (error) { this.disabled = true; throw error; }
  }
  save(data) {
    if (this.disabled) throw new Error('Draft storage is unavailable; existing stored data was left intact.');
    this.storage.setItem(this.key, JSON.stringify(data));
  }
}
