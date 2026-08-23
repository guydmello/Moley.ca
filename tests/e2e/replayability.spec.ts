import { expect, test } from '@playwright/test';
import { APP_VERSION, MAX_PROTOCOL_VERSION, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION } from '@moley/shared';

test('new presets and searchable progressive settings are discoverable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  await page.goto('/');
  await page.getByRole('button', { name: /Create game/i }).first().click();
  for (const preset of ['Classic', 'Online', 'Party', 'Quick', 'Big Group', 'Family', 'Chaos', 'Sweaty']) {
    await expect(page.getByRole('button', { name: new RegExp(preset, 'i') })).toBeVisible();
  }
  await page.getByPlaceholder('e.g. Guy').fill('Replay Tester');
  await page.getByRole('button', { name: /Quick/i }).click();
  await page.getByRole('button', { name: /Create my room/i }).click();
  await expect(page.getByText(/QUICK/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Game settings' }).click();
  await page.getByPlaceholder('Search settings…').fill('crowd');
  await expect(page.getByRole('heading', { name: 'Crowd pack' })).toBeVisible();
  await expect(page.getByText(/Each player can privately add one validated word/i)).toBeVisible();
});

test('runtime config advertises compatibility and public lifecycle state', async ({ request }) => {
  const response = await request.get('/api/config');
  expect(response.ok()).toBeTruthy();
  const config = await response.json();
  expect(config).toMatchObject({ appVersion: APP_VERSION, protocol: PROTOCOL_VERSION, protocolRange: { min: MIN_PROTOCOL_VERSION, max: MAX_PROTOCOL_VERSION } });
  expect(config.features).not.toHaveProperty('secrets');
  expect(config.features.drawing).toMatch(/beta|production|disabled/);
});
