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
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard modal audit runs once in desktop Chromium.');
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

