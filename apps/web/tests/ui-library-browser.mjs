import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const url = process.env.CONTINUUM_WEB_URL || 'http://127.0.0.1:5175';
const output = fileURLToPath(new URL('../../../outputs/ui-library/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
try {
  // The default service entry must render too; demo-only checks missed its crash.
  const serviceEntry = await browser.newPage();
  serviceEntry.on('pageerror', e => errors.push(e.message));
  await serviceEntry.goto(url);
  await expect(serviceEntry.getByRole('heading', { name: 'Welcome back to Continuum.' })).toBeVisible();
  await serviceEntry.close();
  await page.goto(`${url}/?mode=demo`);
  await page.getByRole('button', { name: 'Fill demo credentials' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Use sample repository' }).click();
  await page.getByText('Prototype simulation options', { exact: true }).click();
  const simulation = page.getByRole('checkbox');
  await simulation.check();
  await expect(simulation).toBeChecked();
  await simulation.uncheck();
  await page.getByRole('button', { name: 'Prepare review workspace' }).click();
  await page.getByRole('button', { name: 'Go to workspace' }).click({ timeout: 20000 });
  await page.screenshot({ path: `${output}/workspace.png`, fullPage: true });

  const workspace = page.locator('.scope-selector');
  await workspace.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu', { name: 'Switch workspace' })).toBeVisible();
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(workspace).toBeFocused();

  const record = page.getByRole('button', { name: 'Record intent', exact: true });
  await record.click();
  const dialog = page.getByRole('dialog', { name: 'Record Design Intent' });
  await expect(dialog).toBeVisible();
  const kind = dialog.getByRole('combobox', { name: 'Intent Record Type' });
  await kind.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(kind).toContainText('Refactoring Constraint');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await kind.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Intent Title / Proposition Summary').fill('UI library browser verification');
  await dialog.getByLabel('Full Technical Rationale & Context').fill('Synthetic test entry for form submission.');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: `${output}/record-dialog.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(record).toBeFocused();

  await record.click();
  await dialog.getByLabel('Intent Title / Proposition Summary').fill('Library form submission');
  await dialog.getByLabel('Full Technical Rationale & Context').fill('Synthetic browser verification of shared controls.');
  await dialog.getByRole('button', { name: 'Record & Link Intent' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();

  await workspace.focus();
  await page.keyboard.press('Control+k');
  const command = page.getByRole('dialog', { name: 'Continuum Global Omnibar' });
  await expect(command).toBeVisible();
  await command.getByRole('combobox').fill('no-matching-artifact-xyz');
  await expect(command.getByText('No matching artifacts, actions, or modules found.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(command).toHaveCount(0);
  await expect(workspace).toBeFocused();

  await page.getByRole('button', { name: 'Review changes', exact: false }).first().click();
  await page.locator('.judgment-row').first().click();
  const evidenceTab = page.getByRole('tab', { name: 'Evidence & Context' });
  await evidenceTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Revision History/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(evidenceTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'GitHub Code & Symbols Viewer' }).click();
  const viewer = page.getByRole('dialog', { name: 'GitHub-Style Code & Symbols Explorer' });
  await expect(viewer).toBeVisible();
  await viewer.locator('.gh-breadcrumb-file').click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeVisible();
  await page.screenshot({ path: `${output}/code-viewer.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(page.locator('.inspector')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close inspector drawer (Escape)' }).click();
  await record.click();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${output}/record-mobile.png`, fullPage: true });
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Review summary', exact: true }).first().click();
  await page.getByRole('tab', { name: /Follow-up work/ }).click();
  await page.getByRole('button', { name: 'Record completion', exact: true }).first().click();
  await page.getByLabel('What changed, and how was it checked?').fill('Synthetic browser verification of the follow-up form.');
  await page.getByRole('button', { name: 'Save completion note', exact: true }).click();
  await expect(page.getByText('Completion recorded:', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Passed: demo entry and submit, Base UI menus/select keyboard input and checkbox state, Base UI dialog focus/escape/outside click, nested popup escape, code viewer, Radix tabs, cmdk search, Sonner notification, mobile bounds, follow-up form submission; no browser errors.');
} catch (error) { console.log('Browser errors:', errors); await page.screenshot({path: `${output}/failure.png`}); throw error; } finally { await browser.close(); }
