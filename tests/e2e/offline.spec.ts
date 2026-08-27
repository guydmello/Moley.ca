import { expect, test, type Page } from '@playwright/test';

async function finishRoleHandoff(page: Page) {
  await expect(page.getByRole('heading', { name: /Pass to Alex/i })).toBeVisible();
  await page.getByRole('button', { name: /reveal privately/i }).click();
  await expect(page.getByText(/YOUR SECRET WORD|YOU ARE THE/)).toBeVisible();
  await page.getByRole('button', { name: /Hide & pass on/i }).click();
}

async function finishClues(page: Page) {
  for (let turn = 0; turn < 4; turn++) {
    const botButton = page.getByRole('button', { name: /Let .* think/i });
    if (await botButton.isVisible().catch(() => false)) { await botButton.click(); await page.waitForTimeout(30); }
    else {
      await page.getByPlaceholder('One meaningful clue…').fill(`human clue ${turn}`);
      await page.getByRole('button', { name: /Lock clue/i }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Who sounds suspicious?' })).toBeVisible();
}

async function finishVoteAndRound(page: Page) {
  await page.getByRole('button', { name: /Start secret voting/i }).click();
  await page.getByRole('button', { name: /I'm Alex/i }).click();
  await page.locator('.local-vote-grid button').first().click();
  await page.getByRole('button', { name: /Reveal the vote/i }).click();
  if (await page.getByText('ONE LAST CHANCE').isVisible().catch(() => false)) await page.locator('.local-board button').first().click();
  await expect(page.getByText(/ROUND \d+ COMPLETE|MATCH COMPLETE/).first()).toBeVisible();
}

test('cached production PWA completes, restores, and rematches a true offline local game', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One production service-worker project is sufficient.');
  const productionOrigin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8787';
  await page.goto(`${productionOrigin}/local`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys()))).flat().map((request) => request.url));
  expect(cachedUrls.some((url) => url.includes('/api/'))).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Play Moley locally.' })).toBeVisible();
  await page.getByPlaceholder('Player 1').fill('Alex');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('First to').selectOption('3');
  await page.getByLabel('Fast Bots').check();
  await page.getByRole('button', { name: /Start game/i }).click();

  await finishRoleHandoff(page);
  const firstOrder = await page.locator('.local-turn-order li strong').allTextContents();
  await finishClues(page);
  await finishVoteAndRound(page);

  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
  await expect(page.getByText(/ROUND 1 COMPLETE|MATCH COMPLETE/).first()).toBeVisible();

  for (let round = 2; round <= 6; round++) {
    const next = page.getByRole('button', { name: /Start next round/i });
    if (!await next.isVisible().catch(() => false)) break;
    await next.click();
    await finishRoleHandoff(page);
    if (round === 2) {
      const secondOrder = await page.locator('.local-turn-order li strong').allTextContents();
      expect(secondOrder).not.toEqual(firstOrder);
      await page.reload();
      await page.getByRole('button', { name: /Resume Local Game/i }).click();
      expect(await page.locator('.local-turn-order li strong').allTextContents()).toEqual(secondOrder);
    }
    await finishClues(page);
    await finishVoteAndRound(page);
  }

  await expect(page.getByText(/MATCH COMPLETE/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Rematch' }).click();
  await finishRoleHandoff(page);
  await expect(page.getByText('ROUND 1', { exact: true })).toBeVisible();
  await expect(page.locator('.local-board span')).toHaveCount(25);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/')))).toBe(false);
});

test('private local role is hidden after browser back, forward, and recovery', async ({ page }) => {
  await page.goto('/local');
  await page.getByPlaceholder('Player 1').fill('Alex');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: /Start game/i }).click();
  await page.getByRole('button', { name: /reveal privately/i }).click();
  await page.goBack();
  await page.goForward();
  const resume = page.getByRole('button', { name: /Resume Local Game/i });
  await expect.poll(async () => await resume.isVisible().catch(() => false) || await page.getByRole('button', { name: /reveal privately/i }).isVisible().catch(() => false)).toBe(true);
  if (await resume.isVisible().catch(() => false)) await resume.click();
  await expect(page.getByRole('button', { name: /reveal privately/i })).toBeVisible();
  await expect(page.getByText('YOUR SECRET WORD')).toBeHidden();
});
