import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuumApi, ServiceError } from './serviceApi.js';
import { DraftStore, draftKey, judgmentInput, chooseSelection, optionalReason, reasonLabel, allSelections, buildCompareOptions } from './serviceModel.js';
import { computeLineDiff } from './diff.js';
import { rankEvidenceItems, findEnclosingStructureItem, classifyCandidateSignal, resolveEvidenceEnclosingLabel } from './evidenceSignal.js';
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

test('classifyCandidateSignal separates Healthchecks-style low-signal noise, moderate, high, and manual links', () => {
  const highManual = classifyCandidateSignal({
    assertion: { type: 'implements', methodId: 'manual-assertion-v1' },
    projection: { validity: 'candidate' },
    evidence: [],
  });
  assert.equal(highManual.tier, 'high');

  const highStem = classifyCandidateSignal({
    assertion: { type: 'documents', methodId: 'lexical-file-v1' },
    projection: { validity: 'candidate' },
    signalMeta: { uniqueTokenCount: 8, rareTokenCount: 3, stemOverlap: true, hasExplicitPath: false, topTokens: ['webhook'] },
    evidence: [{ locator: { kind: 'field', startLine: 1 } }],
  });
  assert.equal(highStem.tier, 'high');

  const moderate = classifyCandidateSignal({
    assertion: { type: 'documents', methodId: 'lexical-file-v1' },
    projection: { validity: 'candidate' },
    signalMeta: { uniqueTokenCount: 6, rareTokenCount: 2, stemOverlap: false, hasExplicitPath: false, topTokens: ['token', 'header'] },
    evidence: Array.from({ length: 10 }, (_, idx) => ({ locator: { kind: 'lines', startLine: idx + 1 } })),
  });
  assert.equal(moderate.tier, 'moderate');

  const lowNoise = classifyCandidateSignal({
    assertion: { type: 'documents', methodId: 'lexical-file-v1' },
    projection: { validity: 'candidate' },
    signalMeta: { uniqueTokenCount: 2, rareTokenCount: 0, stemOverlap: false, hasExplicitPath: false, topTokens: ['http', 'site'] },
    evidence: [{ locator: { kind: 'lines', startLine: 10 } }, { locator: { kind: 'lines', startLine: 20 } }],
  }, Array.from({ length: 10 }, () => ({})));
  assert.equal(lowNoise.tier, 'low');
});

test('findEnclosingStructureItem picks narrowest enclosing Python method or Markdown section', () => {
  const pyItems = [
    { id: 'c1', kind: 'class', name: 'Mailer', qualifiedName: 'Mailer', startLine: 10, endLine: 45, level: 0 },
    { id: 'm1', kind: 'method', name: 'send_ping', qualifiedName: 'Mailer.send_ping', startLine: 18, endLine: 30, level: 1 },
  ];
  const hit = findEnclosingStructureItem(pyItems, { kind: 'lines', startLine: 24, endLine: 24 });
  assert.equal(hit.id, 'm1');
  assert.equal(hit.label, 'in Mailer.send_ping()');

  const mdItems = [
    { id: 's1', kind: 'section', name: 'Overview', startLine: 1, endLine: 25, level: 1 },
    { id: 's2', kind: 'section', name: 'Webhook Payload', startLine: 8, endLine: 20, level: 2 },
  ];
  const secHit = findEnclosingStructureItem(mdItems, { kind: 'lines', startLine: 12, endLine: 15 });
  assert.equal(secHit.id, 's2');
  assert.equal(secHit.label, '§ Webhook Payload');
});

test('allSelections flattens revisions across multiple custom inventories in a repository', () => {
  const flat = allSelections({
    id: 'custom_repo_1',
    inputs: [
      {
        id: 'inv_0',
        isCustom: true,
        revisions: [{ label: 'R0 (abc1234)', objectAlgorithm: 'sha256', commitId: 'abc1234000' }],
        profiles: [{ id: 'lexical-file-v1' }],
      },
      {
        id: 'inv_1',
        isCustom: true,
        revisions: [{ label: 'R1 (def5678)', objectAlgorithm: 'sha256', commitId: 'def5678000' }],
        profiles: [{ id: 'lexical-file-v1' }],
      },
    ],
  });
  assert.equal(flat.length, 2);
  assert.equal(flat[0].selection.inventoryId, 'inv_0');
  assert.equal(flat[1].selection.inventoryId, 'inv_1');
  assert.equal(flat[1].selection.targetRevision.commitId, 'def5678000');
  assert.equal(flat[1].isCustom, true);
});

test('resolveEvidenceEnclosingLabel uses prior AST for unresolved shifted evidence rather than target AST', () => {
  const r0Source = {
    id: 'v0',
    structure: {
      items: [
        { id: 's0', kind: 'method', name: 'calculate_subtotal', qualifiedName: 'PricingEngine.calculate_subtotal', startLine: 4, endLine: 8, level: 1 },
        { id: 's1', kind: 'method', name: 'apply_discount', qualifiedName: 'PricingEngine.apply_discount', startLine: 10, endLine: 13, level: 1 },
      ],
    },
  };
  const r1Source = {
    id: 'v1',
    structure: {
      items: [
        { id: 't0', kind: 'method', name: 'calculate_subtotal', qualifiedName: 'PricingEngine.calculate_subtotal', startLine: 9, endLine: 13, level: 1 },
        { id: 't1', kind: 'method', name: 'apply_discount', qualifiedName: 'PricingEngine.apply_discount', startLine: 15, endLine: 20, level: 1 },
      ],
    },
  };
  const sources = new Map([['v0', r0Source], ['v1', r1Source]]);
  const priorMap = new Map([['v1', 'v0']]);

  const unresolved = resolveEvidenceEnclosingLabel(
    { artifactVersionId: 'v1', availability: 'unresolved', locator: { kind: 'lines', startLine: 10, endLine: 13 } },
    sources,
    priorMap
  );
  assert.equal(unresolved.label, 'Prior: in PricingEngine.apply_discount()');
  assert.equal(unresolved.isUnresolved, true);

  const available = resolveEvidenceEnclosingLabel(
    { artifactVersionId: 'v1', availability: 'available', locator: { kind: 'lines', startLine: 9, endLine: 13 } },
    sources,
    priorMap
  );
  assert.equal(available.label, 'in PricingEngine.calculate_subtotal()');
  assert.equal(available.isUnresolved, false);
});

test('buildCompareOptions selects settled R0->R1 comparison snapshot as default baseline for R2', () => {
  const r0Sel = { repositoryId: 'r1', targetRevision: { objectAlgorithm: 'sha1', commitId: 'aaaaaaa' }, baseRevision: null, inventoryId: 'i0', configurationId: 'p0' };
  const r1Sel = { repositoryId: 'r1', targetRevision: { objectAlgorithm: 'sha1', commitId: 'bbbbbbb' }, baseRevision: null, inventoryId: 'i1', configurationId: 'p1' };
  const r2Sel = { repositoryId: 'r1', targetRevision: { objectAlgorithm: 'sha1', commitId: 'ccccccc' }, baseRevision: null, inventoryId: 'i2', configurationId: 'p2' };
  const r0ToR1Comp = {
    snapshotId: 'snap-comp-r0-r1',
    selection: { repositoryId: 'r1', targetRevision: { objectAlgorithm: 'sha1', commitId: 'bbbbbbb' }, baseRevision: { objectAlgorithm: 'sha1', commitId: 'aaaaaaa' }, inventoryId: 'i1', configurationId: 'p1', comparisonId: 'comp-1' },
  };
  const opts = buildCompareOptions({
    revisionChoices: [
      { label: 'R0', isCustom: true, selection: r0Sel },
      { label: 'R1', isCustom: true, selection: r1Sel },
      { label: 'R2', isCustom: true, selection: r2Sel },
    ],
    capturedChoices: [
      r0ToR1Comp,
      { snapshotId: 'snap-r2', selection: r2Sel },
      { snapshotId: 'snap-r1', selection: r1Sel },
      { snapshotId: 'snap-r0', selection: r0Sel },
    ],
    currentSelection: r2Sel,
    targetCommit: 'ccccccc',
  });
  assert.equal(opts.defaultBaseKey, 'snap:snap-comp-r0-r1');
  assert.ok(opts.baselineOptions.some(o => o.label === 'Revalidated R0 → R1 · bbbbbbb' && o.snapshotId === 'snap-comp-r0-r1'));
});
