import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuumApi, ServiceError } from './serviceApi.js';
import { DraftStore, draftKey, judgmentInput, chooseSelection, optionalReason, reasonLabel } from './serviceModel.js';
import { computeLineDiff } from './diff.js';
import { rankEvidenceItems } from './evidenceSignal.js';
import { buildAuditReportMarkdown } from './auditReport.js';

test('only initial candidates allow absent reason and drafts remain verbatim', () => {
  const detail = { mode: 'active', projection: { kind: 'initial', comparisonId: null, validity: 'candidate', resolution: 'open' }, evidence: [{ id: 'e' }] };
  const draft = { decision: 'confirm', reason: '  ', inspected: true, contentConcern: '', followUpKind: 'none' };
  assert.equal(optionalReason(detail, 'confirm'), true);
  assert.equal(judgmentInput(detail, draft).reason, null);
  assert.equal(draft.reason, '  ');
  assert.equal(judgmentInput(detail, { ...draft, reason: '  My evidence.  ' }).reason, '  My evidence.  ');
  assert.equal(judgmentInput(detail, { ...draft, decision: 'reject', inspected: false }).reason, null);
  assert.throws(() => judgmentInput(detail, { ...draft, inspected: false }), /Inspect/);
  assert.throws(() => judgmentInput({ ...detail, projection: { ...detail.projection, kind: 'incoming' } }, draft), /reason/);
  assert.equal(reasonLabel(null), 'No reason provided');
  assert.equal(reasonLabel('  '), 'No reason provided');
  assert.equal(reasonLabel('  Text  '), '  Text  ');
});

test('service errors retain uncertainty without exposing a synthetic fallback', async () => {
  const api = new ContinuumApi(async () => { throw new TypeError('offline'); });
  await assert.rejects(api.workspace(), e => e instanceof ServiceError && e.uncertain);
  const rejected = new ContinuumApi(async () => new Response(JSON.stringify({ error: { code: 'snapshot_conflict', message: 'Refresh current context' } }), { status: 409 }));
  await assert.rejects(rejected.workspace(), e => e.status === 409 && !e.uncertain && e.code === 'snapshot_conflict');
  const malformed = new ContinuumApi(async () => new Response('<html>Proxy response</html>', { status: 200 }));
  await assert.rejects(malformed.workspace(), e => e.status === 502 && e.uncertain);
});

test('session csrf stays in memory and commands keep their exact request identity', async () => {
  const requests = [];
  const api = new ContinuumApi(async (path, options) => { requests.push([path, options]); return new Response(JSON.stringify(path.endsWith('/session') ? { actorId: 'a', csrfToken: 'opaque' } : { result: {} })); });
  await api.session();
  const command = { requestId: 'retained', input: { reason: 'Preserve literal input' } };
  await api.command(command); await api.command(command);
  assert.equal(requests[1][1].headers['X-CSRF-Token'], 'opaque');
  assert.equal(requests[1][1].body, requests[2][1].body);
  assert.equal(requests[1][1].credentials, 'same-origin');
});

test('drafts are isolated by actor, repository, commit, context and assertion revision', () => {
  const entries = new Map(); const storage = { getItem: k => entries.get(k), setItem: (k, v) => entries.set(k, v) };
  const first = new DraftStore(storage, 'alice'); const second = new DraftStore(storage, 'bob');
  const selection = { repositoryId: 'repo', targetRevision: { commitId: 'one' } };
  const row = { projection: { contextId: 'c' }, assertion: { id: 'revision' } };
  const key = draftKey(selection, row);
  first.save({ [key]: { reason: 'Unsent review' }, $pending: { envelope: { requestId: 'same' } } });
  assert.equal(first.load()[key].reason, 'Unsent review'); assert.deepEqual(second.load(), {});
  assert.notEqual(key, draftKey({ ...selection, targetRevision: { commitId: 'two' } }, row));
  assert.notEqual(key, draftKey(selection, { ...row, assertion: { id: 'successor' } }));
});

test('corrupt draft storage is preserved and cannot be overwritten', () => {
  let stored = '{invalid'; const storage = { getItem: () => stored, setItem: (_, v) => { stored = v; } };
  const drafts = new DraftStore(storage, 'a'); assert.throws(() => drafts.load()); assert.throws(() => drafts.save({})); assert.equal(stored, '{invalid');
});

test('confirmation requires active context, inspection and independent follow-up description', () => {
  const detail = { mode: 'active', projection: { contextId: 'c', assertionRevisionId: 'r', projectionVersion: 3, validity: 'candidate', resolution: 'open' }, evidence: [{ id: 'e' }] };
  const draft = { decision: 'confirm', reason: 'Checked exact source', contentConcern: 'Wording', inspected: false, followUpKind: 'none' };
  assert.throws(() => judgmentInput(detail, draft), /Inspect/);
  const input = judgmentInput(detail, { ...draft, inspected: true });
  assert.deepEqual(input.reviewedEvidenceIds, ['e']); assert.equal(input.contentConcern, 'Wording'); assert.deepEqual(input.followUpDisposition, { kind: 'none' });
  assert.throws(() => judgmentInput({ ...detail, mode: 'historical' }, { ...draft, inspected: true }), /historical/);
});

test('selection comes only from a granted repository with a registered profile', () => {
  assert.equal(chooseSelection({ id: 'repo', inputs: [] }), null);
  const selected = chooseSelection({ id: 'repo', inputs: [{ id: 'accepted', profiles: [{ id: 'frozen' }], revisions: [{ commitId: 'exact', objectAlgorithm: 'sha1' }] }] });
  assert.equal(selected.targetRevision.commitId, 'exact'); assert.equal(selected.baseRevision, null);
});

test('computeLineDiff extracts minimal changed hunks cleanly', () => {
  const same = computeLineDiff('a\nb\nc', 'a\nb\nc');
  assert.equal(same.identical, true);
  assert.deepEqual(same.hunks, []);

  const diff = computeLineDiff('line1\noldValue = 1\nline3', 'line1\nnewValue = 2\nextraLine\nline3');
  assert.equal(diff.identical, false);
  assert.equal(diff.removed, 1);
  assert.equal(diff.added, 2);
  assert.equal(diff.hunks.length, 1);
  assert.equal(diff.hunks[0].lines.some(l => l.type === 'del' && l.text === 'oldValue = 1'), true);
  assert.equal(diff.hunks[0].lines.some(l => l.type === 'add' && l.text === 'newValue = 2'), true);
});

test('rankEvidenceItems prioritizes direct file references and shared technical tokens', () => {
  const sources = [
    { id: 'v-doc', identity: { path: 'docs/email.md' }, content: 'generic note\nConfigure hc/api/smtpd.py timeout failure_kw\n' },
    { id: 'v-code', identity: { path: 'hc/api/smtpd.py' }, content: 'failure_kw = True\ntimeout = 30\n' },
  ];
  const evidence = [
    { id: 'e1', artifactVersionId: 'v-doc', locator: { kind: 'lines', startLine: 1, endLine: 1 }, availability: 'available', excerpt: 'generic note' },
    { id: 'e2', artifactVersionId: 'v-doc', locator: { kind: 'lines', startLine: 2, endLine: 2 }, availability: 'available', excerpt: 'Configure hc/api/smtpd.py timeout failure_kw' },
  ];
  const ranked = rankEvidenceItems(evidence, sources, { path: 'docs/email.md' }, { path: 'hc/api/smtpd.py' });
  assert.equal(ranked.items[0].id, 'e2');
  assert.equal(ranked.items[0].isDirect, true);
  assert.equal(ranked.directCount, 1);
  assert.ok(ranked.items[0].sharedTokens.includes('failure'));
});

test('buildAuditReportMarkdown summarizes workspace decisions, diffs and coverage', () => {
  const md = buildAuditReportMarkdown({
    selection: { repositoryId: 'r1' },
    state: { repositories: [{ id: 'r1', fullName: 'healthchecks/healthchecks' }] },
    workspace: {
      mode: 'active',
      artifacts: [{ artifactId: 'a1' }],
      followUps: [],
      comparison: { baseRevision: { commitId: '1111111' }, targetRevision: { commitId: '2222222' }, changes: [{ path: 'a.py', kind: 'modified' }], impacts: [{ contextId: 'c1' }] },
      snapshot: { id: 's1', snapshotVersion: 2, selection: { repositoryId: 'r1', targetRevision: { commitId: '2222222' } }, pendingReviewCount: 0, openFollowUpCount: 0, coverage: [{ function: 'ingestion', status: 'complete', processedCount: 1, eligibleCount: 1 }], limitations: ['Bounded sample'] },
    },
    rows: [{ id: 'c1', sourceLabel: 'docs/a.md', targetLabel: 'a.py', assertion: { type: 'documents', methodId: 'lexical-file-v1', evidenceIds: ['e1'] }, projection: { validity: 'confirmed', resolution: 'resolved' }, priorDecision: { reason: 'Verified directly' } }],
  });
  assert.match(md, /Software Knowledge Continuity Audit Report/);
  assert.match(md, /healthchecks\/healthchecks/);
  assert.match(md, /Verified directly/);
  assert.match(md, /Bounded sample/);
});
