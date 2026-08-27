import { expect, test } from '@playwright/test';

test('local boards fit small phone, large phone landscape, tablet, laptop, and TV', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The explicit viewport matrix runs once in Chromium.');
  const devices = [
    { name: 'small phone portrait', width: 360, height: 640, board: 5, humansOnly: false },
    { name: 'large phone landscape', width: 932, height: 430, board: 7, humansOnly: true },
    { name: 'tablet portrait', width: 768, height: 1024, board: 10, humansOnly: false },
    { name: 'laptop', width: 1440, height: 900, board: 7, humansOnly: true },
    { name: 'TV', width: 1920, height: 1080, board: 10, humansOnly: false }
  ];

  for (const device of devices) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
    const page = await context.newPage();
    await page.goto('/local');
    await page.getByPlaceholder('Player 1').fill('Alex');
    if (device.humansOnly) {
      await page.getByPlaceholder('Player 2').fill('Sam');
      await page.getByPlaceholder('Player 3').fill('Jordan');
      await page.getByPlaceholder('Player 4').fill('Riley');
    } else {
      for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
    }
    await page.getByLabel('Board size').selectOption(String(device.board));
    await page.getByRole('button', { name: /Start game/i }).click();
    const roleCount = device.humansOnly ? 4 : 1;
    for (let role = 0; role < roleCount; role++) {
      await page.getByRole('button', { name: /reveal privately/i }).click();
      await page.getByRole('button', { name: /Hide & pass on/i }).click();
    }
    await expect(page.locator('.local-board span'), device.name).toHaveCount(device.board ** 2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${device.name} horizontal overflow`).toBeLessThanOrEqual(1);
    await context.close();
  }
});
