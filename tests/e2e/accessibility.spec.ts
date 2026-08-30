import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done')));

for (const path of ['/', '/how-to-play', '/pass-the-phone']) {
  test(`${path} has no serious automated accessibility violations`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The full accessibility scan runs once in desktop Chromium.');
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  });
}

test('host settings dialog traps focus, closes with Escape, and restores focus', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'webkit'].includes(testInfo.project.name), 'Keyboard modal audit runs in Chromium and desktop WebKit.');
  await page.goto('/');
  await page.getByRole('button', { name: /Create game/i }).first().click();
  await page.getByPlaceholder('e.g. Guy').fill('Keyboard Host');
  await page.getByRole('button', { name: /Create my room/i }).click();
  const trigger = page.getByRole('button', { name: 'Game settings' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Game setup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Game setup' })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('local board and private voting have no serious automated accessibility violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The staged local accessibility audit runs once in desktop Chromium.');
  await page.goto('/local');
  await page.getByPlaceholder('Player 1').fill('Alex');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('Fast Bots').check();
  await page.getByRole('button', { name: /Start game/i }).click();
  await page.getByRole('button', { name: /reveal privately/i }).click();
  await page.getByRole('button', { name: /Hide & pass on/i }).click();
  await expect(page.locator('.shared-word-board span')).toHaveCount(25);
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);

  for (let turn = 0; turn < 30; turn++) {
    const nextClueRound = page.getByRole('button', { name: /Start Clue Round/i });
    if (await nextClueRound.isVisible().catch(() => false)) { await nextClueRound.click(); continue; }
    const startDiscussion = page.getByRole('button', { name: 'Start Discussion' });
    if (await startDiscussion.isVisible().catch(() => false)) { await startDiscussion.click(); break; }
    const bot = page.getByRole('button', { name: /Let .* think/i });
    if (await bot.isVisible().catch(() => false)) { await bot.click(); await page.waitForTimeout(30); }
    else { await page.getByPlaceholder('One meaningful clue…').fill(`accessible clue ${turn}`); await page.getByRole('button', { name: /Lock clue/i }).click(); }
  }
  await page.getByRole('button', { name: /Start secret voting/i }).click();
  await page.getByRole('button', { name: /I'm Alex/i }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('standalone public TV waiting screen is accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The public TV accessibility scan runs once in desktop Chromium.');
  await page.goto('/local-display/local-accessibility-session');
  await expect(page.getByRole('heading', { name: /Waiting for the host device/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
