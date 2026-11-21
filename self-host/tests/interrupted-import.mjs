// Run against a disposable loopback installation with an existing operator-provisioned
// account and a read-only Git mount. Read { origin, login, password, repoPath, commit,
// expectedCaptured, expectedExcluded } as JSON from stdin. Print only the verification result.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const config = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
const origin = new URL(config.origin);
assert.ok(origin.protocol === 'https:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
assert.ok(Number.isSafeInteger(config.expectedCaptured) && Number.isSafeInteger(config.expectedExcluded));
assert.ok(config.login && config.password && config.repoPath && /^[0-9a-f]{40}$/.test(config.commit));
const name = 'Interrupted import ' + randomUUID();
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: origin.origin, ignoreHTTPSErrors: true });
context.setDefaultTimeout(120000);
let stage = 'sign in';
try {
  const first = await context.newPage();
  await first.goto('/');
  await first.getByLabel('Login', { exact: true }).fill(config.login);
  await first.getByLabel('Password', { exact: true }).fill(config.password);
  await first.getByRole('button', { name: 'Sign in', exact: true }).click();
  await first.getByRole('button', { name: 'Team & governance' }).click();
  await first.getByRole('button', { name: 'New custom workspace' }).click();
  const dialog = first.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Local Git commits' }).click();
  await dialog.getByLabel('Workspace name').fill(name);
  await dialog.getByPlaceholder('/repositories/billing-service').fill(config.repoPath);
  await dialog.getByLabel(/^Commit SHA\(s\)/).fill(config.commit);

  stage = 'drop the committed create-workspace response';
  const admitted = Promise.withResolvers();
  await first.route('**/api/v1/workspaces', async route => {
    try {
      const response = await route.fetch({ timeout: 120000 });
      assert.equal(response.ok(), true, 'create-workspace returned HTTP ' + response.status());
      const { result } = await response.json();
      const payload = route.request().postDataJSON();
      await route.abort('failed');
      admitted.resolve({ payload, result });
    } catch (error) {
      admitted.reject(error);
    }
  }, { times: 1 });
  const [original] = await Promise.all([
    admitted.promise,
    dialog.getByRole('button', { name: 'Create & capture workspace' }).click(),
  ]);
  assert.equal(original.payload.runDiscovery, true);
  await first.close();

  stage = 'resume in a newly opened tab';
  const second = await context.newPage();
  await second.goto('/');
  const resume = second.getByRole('button', { name: 'Resume import', exact: true });
  const [replayed] = await Promise.all([
    second.waitForResponse(r => r.url().endsWith('/api/v1/workspaces') && r.request().method() === 'POST'),
    resume.click(),
  ]);
  assert.deepEqual(replayed.request().postDataJSON(), original.payload);
  assert.equal(replayed.ok(), true, 'replay returned HTTP ' + replayed.status());
  const { result } = await replayed.json();
  assert.deepEqual(result, original.result);
  await expect(second.locator('.service-page-context')).toContainText(name, { timeout: 120000 });
  await expect(resume).toHaveCount(0);

  stage = 'check capture, discovery and Git inventory';
  const session = await (await context.request.get('/api/v1/auth/session')).json();
  const descriptor = await (await context.request.get('/api/v1/workspace')).json();
  assert.equal(descriptor.repositories.filter(repo => repo.name === name).length, 1);
  async function query(queryName, input) {
    const response = await context.request.post('/api/v1/queries', {
      headers: { Origin: origin.origin, 'X-CSRF-Token': session.csrfToken },
      data: { schemaVersion: '0.1.0', requestId: randomUUID(), repositoryId: result.repositoryId, query: queryName, input },
    });
    assert.equal(response.ok(), true, queryName + ' returned HTTP ' + response.status());
    return (await response.json()).result;
  }
  const deadline = Date.now() + 180000;
  let workspace;
  do {
    const view = await query('select_context', result.selection);
    workspace = await query('read_workspace', { snapshotId: view.snapshot.id });
    const statuses = workspace.progress.operations.map(op => op.status);
    if (statuses.length >= 2 && statuses.every(status => !['queued', 'running'].includes(status))) break;
    await sleep(1000);
  } while (Date.now() < deadline);
  const operations = workspace.progress.operations;
  assert.deepEqual(operations.map(op => op.kind).sort(), ['capture', 'discovery']);
  const capture = operations.find(op => op.kind === 'capture');
  const discovery = operations.find(op => op.kind === 'discovery');
  assert.equal(capture.id, result.captureOperations[0].operationId);
  assert.equal(capture.status, 'complete');
  assert.ok(['partial', 'complete'].includes(discovery.status), discovery.status);
  if (discovery.status === 'partial') assert.ok(discovery.limitations.length);
  const captureRecord = await query('read_operation', { operationId: capture.id });
  for (const coverage of [captureRecord.coverage, workspace.snapshot.coverage]) {
    const ingestion = coverage.find(row => row.function === 'ingestion');
    assert.equal(ingestion.processedCount, config.expectedCaptured);
    assert.equal(ingestion.excludedCount, config.expectedExcluded);
  }
  assert.equal(workspace.gitInventory.capturedPaths, config.expectedCaptured);
  assert.equal(workspace.gitInventory.excluded.length, config.expectedExcluded);
  await second.reload();
  await second.getByRole('button', { name: 'Revision & snapshot details' }).click();
  const inventory = second.getByLabel('Git file inventory');
  await expect(inventory).toContainText(config.expectedCaptured + ' captured files');
  await expect(inventory).toContainText(config.expectedExcluded + ' excluded paths');
  console.log(JSON.stringify({ repositoryId: result.repositoryId, requestId: original.payload.requestId,
    revision: config.commit, replayMatchedOriginal: true, workspaceCount: 1,
    capture, discovery, capturedFiles: config.expectedCaptured, excludedPaths: config.expectedExcluded,
    refreshedInventoryVisible: true }, null, 2));
} catch (error) {
  console.error('Failed to ' + stage);
  throw error;
} finally {
  await browser.close();
}
