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

test('advanced room features save together without complicating the create flow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project covers the advanced settings combination.');
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  await page.goto('/');
  await page.getByRole('button', { name: /Create game/i }).first().click();
  await page.getByPlaceholder('e.g. Guy').fill('Advanced Host');
  await page.getByRole('button', { name: /Chaos/i }).click();
  await page.getByRole('button', { name: /Create my room/i }).click();
  await page.getByRole('button', { name: 'Game settings' }).click();

  await expect(page.getByRole('button', { name: /Use a public word board/i })).toBeVisible();
  await page.getByLabel('Board size').selectOption('10');
  await page.getByRole('button', { name: /Spectator predictions/i }).click();
  await page.getByRole('button', { name: /Audience reactions/i }).click();
  await page.getByLabel('Room theme').selectOption('campfire');
  await page.getByRole('textbox', { name: /Custom pack/i }).fill('Campfire\nCanoe\nMarshmallow');
  await page.getByRole('button', { name: /Player word submissions/i }).click();
  await page.getByRole('button', { name: /Save settings/i }).click();

  await expect(page.locator('.game-app')).toHaveClass(/theme-campfire/);
  await expect(page.getByText(/10×10 board/i)).toBeVisible();
  await expect(page.getByText(/Chaos on/i)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moley:settings') ?? '{}'));
  expect(saved).toMatchObject({
    preset: 'chaos', boardEnabled: true, boardSize: 10, chaosMode: true,
    spectatorPredictions: true, audienceReactions: true, crowdPack: true,
    roomTheme: 'campfire', customWords: ['Campfire', 'Canoe', 'Marshmallow']
  });
});

test('runtime config advertises compatibility and public lifecycle state', async ({ request }) => {
  const response = await request.get('/api/config');
  expect(response.ok()).toBeTruthy();
  const config = await response.json();
  expect(config).toMatchObject({ appVersion: APP_VERSION, protocol: PROTOCOL_VERSION, protocolRange: { min: MIN_PROTOCOL_VERSION, max: MAX_PROTOCOL_VERSION } });
  expect(config.features).not.toHaveProperty('secrets');
  expect(config.features.drawing).toMatch(/beta|production|disabled/);
});
