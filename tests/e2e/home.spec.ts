import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
});

test('landing page exposes every primary play path', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Find the Mole/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create game/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Join game/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Pass it around/i })).toBeVisible();
  const desktopHow = page.getByRole('navigation').getByRole('button', { name: 'How to play' });
  if (await desktopHow.isVisible()) await desktopHow.click();
  else await page.getByRole('contentinfo').getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('heading', { name: 'How to play Moley' })).toBeVisible();
});

test('pass-the-phone protects each role behind a handoff screen', async ({ page }) => {
  await page.goto('/pass-the-phone');
  for (const [index, name] of ['Alex', 'Sam', 'Maya', 'Jordan'].entries()) {
    await page.getByPlaceholder(`Player ${index + 1}`).fill(name);
  }
  await page.getByRole('button', { name: /Start game/i }).click();
  await expect(page.getByRole('heading', { name: 'Pass to Alex' })).toBeVisible();
  await page.getByRole('button', { name: /HOLD TO REVEAL/i }).click();
  await expect(page.getByRole('button', { name: /Hide & pass on/i })).toBeVisible();
  await page.getByRole('button', { name: /Hide & pass on/i }).click();
  await expect(page.getByRole('heading', { name: 'Pass to Sam' })).toBeVisible();
  await expect(page.getByText('APPLE')).not.toBeVisible();
});
