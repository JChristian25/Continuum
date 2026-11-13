import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { url, password } = JSON.parse(input);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
let latestContext;
page.on('pageerror', e => errors.push(e.message));
page.on('response', async response => { if (/\/contexts\/[^/?]+\?/.test(response.url()) && response.ok()) latestContext = await response.json(); });
try {
  // Prior demo storage cannot authenticate or populate the normal application.
  await page.addInitScript(() => { sessionStorage.setItem('CONTINUUM_DEMO_SESSION', JSON.stringify({ name: 'Old demo' })); });
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Welcome back to Continuum.' })).toBeVisible();
  await page.getByLabel('Login', { exact: true }).fill('alice');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('LIVE SERVICE · active', { exact: false })).toBeVisible();
  await expect.poll(async () => (await page.locator('.focus-brief').boundingBox()).height).toBeGreaterThan(150);
  await expect(page.locator('.service-row')).toHaveCount(0);
  await page.screenshot({ path: fileURLToPath(new URL('../../../outputs/frontend-integration/workspace.png', import.meta.url)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: fileURLToPath(new URL('../../../outputs/frontend-integration/workspace-mobile.png', import.meta.url)), fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Workspace overflows the mobile viewport');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.locator('.service-row')).toHaveCount(19);
  await expect(page.locator('body')).not.toContainText('src/bbb.py');
  await page.locator('.service-row').first().click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await expect(page.locator('.service-inspector .code-box')).toHaveCount(2);
  await page.getByRole('button', { name: 'review', exact: true }).click();
  await page.getByLabel('Relationship judgment').selectOption('confirm');
  await page.getByLabel('Reason', { exact: true }).fill('Isolated browser verification of exact-source review; not a research assessment.');
  await page.getByLabel('I inspected the exact sources and recorded evidence.').check();
  // Draft survives leaving the context and a browser reload.
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.locator('.service-row')).toHaveCount(19);
  await page.locator('.service-row').first().click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'review', exact: true }).click();
  await expect.poll(() => page.getByRole('textbox', { name: 'Reason', exact: true }).inputValue()).toContain('Isolated browser verification');
  await expect(page.getByLabel('Relationship judgment')).toHaveValue('confirm');
  // Another successful operation makes the displayed projection stale.
  const session = await context.request.get(`${url}/api/v1/auth/session`).then(r => r.json());
  const competing = await context.request.post(`${url}/api/v1/commands`, { headers: { Origin: url, 'X-CSRF-Token': session.csrfToken }, data: {
    schemaVersion: '0.1.0', requestId: crypto.randomUUID(), repositoryId: 'repo', viewId: latestContext.viewId, command: 'open_follow_up',
    input: { contextId: latestContext.projection.contextId, assertionRevisionId: latestContext.assertion.id, expectedProjectionVersion: latestContext.projection.projectionVersion, workKind: 'documentation_update', note: 'Isolated competing browser request', relatedJudgmentEventId: null },
  } });
  if (!competing.ok()) throw new Error('Competing request failed');
  await page.getByRole('button', { name: 'Save judgment', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry retained request' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Reason', exact: true })).toHaveValue('Isolated browser verification of exact-source review; not a research assessment.');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.locator('.service-row').first().click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'review', exact: true }).click();
  // Lose the response after the command commits, then replay the identical envelope.
  const envelopes = [];
  await page.route('**/api/v1/commands', async route => {
    envelopes.push(route.request().postDataJSON());
    if (envelopes.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save judgment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry retained request' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry retained request' }).click();
  await expect(page.getByRole('button', { name: 'Retry retained request' })).toHaveCount(0);
  await expect(page.locator('.service-chip').filter({ hasText: /^confirmed$/ })).toHaveCount(1);
  if (JSON.stringify(envelopes[0]) !== JSON.stringify(envelopes[1])) throw new Error('Retry changed the original request');
  await page.unroute('**/api/v1/commands');
  await page.locator('.service-row').filter({ hasText: 'confirmed' }).click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'history', exact: true }).click();
  await expect(page.locator('.service-inspector')).toContainText('Isolated browser verification');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  // Retained snapshots are readable and cannot accept a judgment.
  await page.getByText('Revision & snapshot details', { exact: true }).click();
  const retained = page.getByLabel('Retained snapshot');
  const historical = await retained.locator('option').evaluateAll(options => options.find(o => o.textContent.includes('historical') && !o.textContent.includes('Version 0'))?.value);
  await retained.selectOption(historical);
  await expect(page.getByText('LIVE SERVICE · historical', { exact: false })).toBeVisible();
  await page.locator('.service-row').first().click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save judgment', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Code explorer', exact: true }).click();
  await page.locator('.service-row').first().click();
  await expect(page.locator('.service-file-grid .code-box')).toBeVisible();
  await page.getByLabel('Selected revision').selectOption('c62d6648d81e1aebc65f80bddc72f165fba7320b');
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.locator('.service-row')).toHaveCount(0);
  await page.getByText('Compare revisions', { exact: true }).click();
  await page.getByRole('button', { name: 'Compare and review impact' }).click();
  await expect(page.getByText(/changed paths · .* affected relationships/)).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.service-row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back to Continuum.' })).toBeVisible();
  await page.getByLabel('Login', { exact: true }).fill('bob');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Review relationships', exact: true }).click();
  await expect(page.locator('.service-row')).toHaveCount(19);
  await expect(page.getByRole('button', { name: 'Record intent', exact: true })).toBeDisabled();
  await page.locator('.service-row').first().click();
  await expect(page.getByRole('heading', { name: 'Recorded evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save judgment', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  // API failure cannot restore the old synthetic session or show fixture rows.
  await page.route('**/api/v1/auth/session', route => route.abort('failed'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back to Continuum.' })).toBeVisible();
  await expect(page.locator('.service-row')).toHaveCount(0);
  const demoContext = await browser.newContext();
  const demo = await demoContext.newPage();
  await demo.goto(`${url}/?mode=demo`);
  await expect(demo.getByLabel('Demo email', { exact: true })).toBeVisible();
  await demoContext.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ passed: true, cases: ['cookie login', 'demo isolation', 'real snapshot', 'exact sources', 'durable draft', 'stale projection preserves draft', 'lost response identical retry', 'persisted judgment and history', 'retained historical read-only', 'file explorer', 'viewer read-only', 'logout', 'offline fails closed'], pageErrors: errors }));
} finally { await browser.close(); }
