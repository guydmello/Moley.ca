import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  ['phone 360×800', 360, 800],
  ['phone 375×667', 375, 667],
  ['phone 390×844', 390, 844],
  ['phone 412×915', 412, 915],
  ['phone 430×932', 430, 932],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop 1280×720', 1280, 720],
  ['laptop 1366×768', 1366, 768],
  ['laptop 1440×900', 1440, 900],
  ['desktop 1920×1080', 1920, 1080],
  ['desktop 2560×1440', 2560, 1440],
  ['TV 1920×1080', 1920, 1080],
  ['TV 3840×2160', 3840, 2160]
] as const;

test('required phone, tablet, laptop, desktop, and TV viewports remain usable', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The explicit viewport matrix runs once in Chromium.');
  for (const [name, width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/local');
    await expect(page.getByRole('heading', { name: 'Play Moley locally.' }), name).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${name} horizontal overflow`).toBeLessThanOrEqual(1);
    const start = page.getByRole('button', { name: /Start game locally/i });
    await expect(start, `${name} primary setup action`).toBeVisible();
    await context.close();
  }
});

test('every 5×5 through 10×10 board fits phone, laptop, and TV form factors', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The explicit board matrix runs once in Chromium.');
  test.setTimeout(120_000);
  const formFactors = [
    { name: 'phone', width: 390, height: 844 },
    { name: 'laptop', width: 1440, height: 900 },
    { name: 'TV', width: 1920, height: 1080 }
  ];

  for (const form of formFactors) {
    for (const board of [5, 6, 7, 8, 9, 10]) {
      const context = await browser.newContext({ viewport: { width: form.width, height: form.height } });
      const page = await context.newPage();
      await page.goto('/local');
      await page.getByPlaceholder('Player 1').fill('Alex');
      for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
      await page.getByLabel('Board size').selectOption(String(board));
      await page.getByRole('button', { name: /Start game/i }).click();
      await page.getByRole('button', { name: /reveal privately/i }).click();
      await page.getByRole('button', { name: /Hide & pass on/i }).click();
      const cells = page.locator('.shared-word-board span');
      await expect(cells, `${form.name} ${board}×${board}`).toHaveCount(board ** 2);
      const metrics = await page.locator('.shared-word-board').evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { right: bounds.right, left: bounds.left, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth };
      });
      expect(metrics.left, `${form.name} ${board}×${board} left edge`).toBeGreaterThanOrEqual(-1);
      expect(metrics.right, `${form.name} ${board}×${board} right edge`).toBeLessThanOrEqual(metrics.viewport + 1);
      expect(metrics.pageWidth, `${form.name} ${board}×${board} page width`).toBeLessThanOrEqual(metrics.viewport + 1);
      await context.close();
    }
  }
});
