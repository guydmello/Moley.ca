import { expect, test } from '@playwright/test';

test('lobby and private role screens fit phone and desktop widths', async ({ page, isMobile }, testInfo) => {
  test.skip(Boolean(isMobile), 'The desktop project explicitly controls both review widths.');
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 844 : 1000 });
    await page.goto('/');
    await page.getByRole('button', { name: /Create game/i }).first().click();
    await page.getByPlaceholder('e.g. Guy').fill(`Host ${width}`);
    await page.getByRole('button', { name: /Create my room/i }).click();
    await expect(page.getByRole('heading', { name: /Waiting for suspicious people/i })).toBeVisible();
    for (let count = 0; count < 3; count++) await page.getByRole('button', { name: /Add bot/i }).click();
    await expect(page.getByRole('button', { name: /Start game/i })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`moley-lobby-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: /Start game/i }).click();
    await expect(page.getByRole('heading', { name: /Your secret is ready/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`moley-role-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  }
});
