import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './state.js';
import { commitReview, reviewError, pendingItems, undoCommittedReview } from './workflow.js';
const ready = () => { const s = createInitialState(); s.artifacts['aaa.py::submitUserOrder'].draftRationale = 'Caller still invokes createRequest; adapt dictionary access.'; return s; };
test('queue includes semantic candidate and agrees with open workload', () => { assert.equal(pendingItems(ready()).length, 3); });
test('historical, viewer, empty and unconfirmed AI drafts cannot be saved', () => {
  for (const mutate of [s => s.revisionMode = 'R0', s => s.activeUserId = 'unknown', s => s.artifacts['aaa.py::submitUserOrder'].draftRationale = '', s => s.artifacts['aaa.py::submitUserOrder'].draftIsAi = true]) {
    const s = ready(); mutate(s); assert.ok(reviewError(s, 'aaa.py::submitUserOrder'));
    assert.throws(() => commitReview(s, 'aaa.py::submitUserOrder', 'now', 'event'));
  }
});
test('rejected candidates are reviewed without becoming confirmed support', () => {
  const s = ready(), id = 'docs/onboarding_notes.md';
  s.artifacts[id].draftRationale = 'Only mentions queue states, not this function contract.';
  s.artifacts[id].judgmentChoice = 'Reject candidate';
  const next = commitReview(s, id, 'now', 'reject');
  assert.equal(next.artifacts[id].r1Status, 'reviewed');
  assert.equal(next.artifacts[id].coverageCondition, 'no_link');
});
test('undo targets original artifact even after navigation and preserves other activity', () => {
  const s = ready(), id = 'aaa.py::submitUserOrder', original = s.artifacts[id];
  let next = commitReview(s, id, 'now', 'review-one');
  next = { ...next, selectedArtifactId: 'REQ-02', activityLog: [{ id: 'other' }, ...next.activityLog] };
  const undone = undoCommittedReview(next, original, 'review-one');
  assert.deepEqual(undone.artifacts[id], original); assert.equal(undone.activityLog[0].id, 'other');
  assert.equal(undone.artifacts['REQ-02'].r1Status, 'needs_review');
});
test('failed save preserves draft and counts, successful save records history', () => {
  const s = ready(); s.simulateSaveError = true;
  assert.throws(() => commitReview(s, 'aaa.py::submitUserOrder', 'now', 'error'));
  assert.equal(pendingItems(s).length, 3);
  s.simulateSaveError = false;
  const next = commitReview(s, 'aaa.py::submitUserOrder', 'now', 'success');
  assert.equal(pendingItems(next).length, 2); assert.equal(next.artifacts['aaa.py::submitUserOrder'].reviewHistory.length, 1);
  assert.ok(next.artifacts['aaa.py::submitUserOrder'].savedRationale);
});
