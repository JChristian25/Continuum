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
        subject: revision.subject || '',
        message: revision.message || revision.subject || '',
        authorName: revision.authorName || '',
        authorEmail: revision.authorEmail || '',
        authoredAt: revision.authoredAt || '',
        committedAt: revision.committedAt || '',
        shortCommitId: revision.shortCommitId || (revision.commitId || '').slice(0, 7),
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
  const subjectByCommit = new Map(revisionChoices.map(r => [r.selection.targetRevision.commitId, r.subject || '']));
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
      label: `${r.label} · ${commitId.slice(0, 7)}${r.subject ? ` — ${r.subject}` : ''}`,
      subject: r.subject || '',
      authorName: r.authorName || '',
      authoredAt: r.authoredAt || '',
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
      subject: subjectByCommit.get(sel.targetRevision.commitId) || '',
      captured: true,
    });
  }

  const baselineOptions = [...comparisonOptions, ...initialOptions];
  const activeCommit = targetCommit || currentSelection?.targetRevision?.commitId;
  const currentIdx = initialOptions.findIndex(o => o.commitId === activeCommit);
  const prevInitial = initialOptions.slice(0, Math.max(0, currentIdx)).findLast(o => o.captured)
    || initialOptions.find(o => o.captured && o.commitId !== activeCommit)
    || initialOptions[0];

  const comparisonForPrev = prevInitial
    ? comparisonOptions.find(c => c.commitId === prevInitial.commitId)
    : null;

  const defaultBaseKey = currentSelection?.baseRevision
    ? 'current'
    : (comparisonForPrev?.key || prevInitial?.key || '');

  return { baselineOptions, initialOptions, comparisonOptions, defaultBaseKey };
}

export function chooseSelection(repository, preferred) {
  const inputs = repository?.inputs.filter(item => item.profiles.length && item.revisions.length) || [];
  const input = inputs.find(item => item.id === preferred?.inventoryId) || inputs[0];
  if (!input) return null;
  const profile = input.profiles.find(item => item.id === preferred?.configurationId) || input.profiles[0];
  const revision = input.revisions.find(item => item.commitId === preferred?.targetRevision?.commitId) || input.revisions[0];
  return { repositoryId: repository.id, targetRevision: { objectAlgorithm: revision.objectAlgorithm, commitId: revision.commitId },
    baseRevision: null, inventoryId: input.id, configurationId: profile.id };
}

export function returningSelection(repositories, saved) {
  const previous = repositories.find(repo => repo.id === saved?.repositoryId);
  const chosen = chooseSelection(previous, saved);
  if (!chosen) {
    for (const repository of repositories) {
      const first = chooseSelection(repository);
      if (first) return first;
    }
    return null;
  }
  if (saved.comparisonId && saved.baseRevision?.commitId &&
      chosen.inventoryId === saved.inventoryId && chosen.configurationId === saved.configurationId &&
      chosen.targetRevision.commitId === saved.targetRevision?.commitId) {
    return { ...chosen, comparisonId: saved.comparisonId, baseRevision: saved.baseRevision };
  }
  return chosen;
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

const TRIAGE_RESOLUTIONS = new Set(['open', 'deferred', 'screened']);

export function permittedDecisions(projection) {
  if (projection?.validity === 'candidate' && TRIAGE_RESOLUTIONS.has(projection?.resolution)) return ['confirm', 'reject'];
  if (projection?.resolution === 'open' && projection.validity === 'stale') return ['reconfirm', 'retire'];
  if (projection?.resolution === 'resolved' && projection.validity === 'confirmed') return ['retire'];
  return [];
}

export function permittedTriageDispositions(projection) {
  if (projection?.validity !== 'candidate') return [];
  if (projection.resolution === 'open') return ['defer', 'screen'];
  if (projection.resolution === 'deferred') return ['screen', 'restore'];
  if (projection.resolution === 'screened') return ['defer', 'restore'];
  return [];
}

export const draftKey = (selection, row) => JSON.stringify([
  selection.repositoryId, selection.comparisonId || null, selection.targetRevision.commitId, row.projection.contextId, row.assertion.id,
]);

export const emptyDraft = () => ({ decision: '', reason: '', contentConcern: '', followUpKind: 'none', followUpNote: '', independentNote: '', inspected: false });

export const optionalReason = (detail, decision) => detail?.projection.kind === 'initial'
  && !detail.projection.comparisonId && detail.projection.validity === 'candidate'
  && TRIAGE_RESOLUTIONS.has(detail.projection.resolution) && ['confirm', 'reject'].includes(decision);
export const reasonLabel = reason => typeof reason === 'string' && reason.trim() ? reason : 'No reason provided';

export const REASON_PRESETS = {
  confirm: [
    'Code structure matches documented behavior in inspected anchor.',
    'Symbol reference and target file role align cleanly.',
    'Direct test or CLI entry point exercises this link.',
  ],
  reject: [
    'Coincidental name overlap; target is unrelated.',
    'Generated, vendor, or fixture match outside semantic scope.',
    'Superseded reference does not reflect active relationship.',
  ],
  reconfirm: [
    'Inspected incoming diff confirms relationship remains accurate.',
    'Implementation adjusted while preserving documented link.',
  ],
  retire: [
    'Change removed or decoupled the documented connection.',
    'Relationship no longer applies in the updated revision.',
  ],
};

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
