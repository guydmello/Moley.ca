import { expect, test } from '@playwright/test';

test('production PWA reloads pass-the-phone offline without caching API responses', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One production service-worker project is sufficient.');
  await page.goto('http://127.0.0.1:8787/pass-the-phone');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.request.get('http://127.0.0.1:8787/api/config');
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys()))).flat().map((request) => request.url));
  expect(cachedUrls.some((url) => url.includes('/api/'))).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pass the phone' })).toBeVisible();
  await page.getByPlaceholder('Player 1').fill('Alex');
  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Add bot' }).click();
  await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled();
});
