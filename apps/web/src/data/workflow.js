import { CHANGE_NEIGHBOR_IDS } from './state.js';

export const REVIEW_IDS = [...CHANGE_NEIGHBOR_IDS, 'docs/onboarding_notes.md'];
export const JUDGMENTS = ['Confirm valid with change', 'Keep link · Flag content issue', 'Reject candidate', 'Retire relationship'];
export const DISPOSITIONS = ['No edit needed', 'Code update open', 'Doc update deferred'];
export const reviewItems = state => REVIEW_IDS.map(id => state.artifacts[id]).filter(Boolean);
export const pendingItems = state => reviewItems(state).filter(item => item.r1Status !== 'reviewed');
export const followUpItems = state => reviewItems(state).filter(item => item.r1Status === 'reviewed' && item.followUpWork !== 'No edit needed');

export function reviewError(state, artifactId) {
  if (state.revisionMode !== 'R1') return 'Viewing historical baseline. Switch to Incoming Change to record a judgment.';
  if (state.teamMembers.find(member => member.id === state.activeUserId)?.authority !== 'Authorized Reviewer') return 'This persona has read-only access. Choose a reviewer persona to record a judgment.';
  const artifact = state.artifacts[artifactId];
  if (!artifact || !REVIEW_IDS.includes(artifactId)) return 'This artifact is outside the current review queue.';
  if (!JUDGMENTS.includes(artifact.judgmentChoice) && artifact.judgmentChoice !== 'Confirm valid at R1') return 'Choose a relationship judgment.';
  if (!DISPOSITIONS.includes(artifact.followUpWork)) return 'Choose a follow-up disposition.';
  if (artifact.draftIsAi) return 'Confirm or edit the suggested draft before saving.';
  if (!(artifact.draftRationale ?? artifact.savedRationale ?? '').trim()) return 'Add a rationale so the next reviewer can understand your decision.';
  if (state.simulateSaveError) return 'Demo save failed. Your draft is preserved. Turn off the simulated error and retry.';
  return '';
}

export function commitReview(state, artifactId, timestamp, eventId) {
  const error = reviewError(state, artifactId);
  if (error) throw new Error(error);
  const original = state.artifacts[artifactId];
  const user = state.teamMembers.find(member => member.id === state.activeUserId);
  const artifact = { ...original, savedRationale: (original.draftRationale ?? original.savedRationale).trim(), r1Status: 'reviewed', r1Reviewer: user.shortName, r1ReviewedAt: timestamp, lastReviewId: eventId };
  const accepted = ['Confirm valid with change', 'Confirm valid at R1', 'Keep link · Flag content issue'].includes(artifact.judgmentChoice);
  if (artifact.relKind === 'candidate') {
    artifact.coverageCondition = accepted ? 'reviewed' : 'no_link';
    artifact.coverageBadge = accepted ? 'Reviewed Support' : 'No confirmed support';
  }
  if (original.followUpWork !== original.savedFollowUpWork) {
    artifact.followUpResolved = false;
    artifact.followUpResolution = '';
  }
  artifact.savedFollowUpWork = artifact.followUpWork;
  const record = { id: eventId, time: timestamp, actor: user.shortName, action: `Reviewed ${artifact.shortName} with change`, detail: `${artifact.judgmentChoice} · ${artifact.followUpWork}`, rationale: artifact.savedRationale, artifactId, badge: 'Reviewed with change' };
  artifact.reviewHistory = [record, ...(original.reviewHistory || [])];
  return { ...state, artifacts: { ...state.artifacts, [artifactId]: artifact }, reviewFormOpen: false, reviewError: '', lastSavedReview: { artifactId, eventId }, activityLog: [record, ...state.activityLog] };
}

export function undoCommittedReview(state, original, eventId) {
  if (state.artifacts[original.id]?.lastReviewId !== eventId) return state;
  return { ...state, artifacts: { ...state.artifacts, [original.id]: original }, selectedArtifactId: original.id, inspectorOpen: true, reviewFormOpen: true, lastSavedReview: null, activityLog: state.activityLog.filter(event => event.id !== eventId) };
}
