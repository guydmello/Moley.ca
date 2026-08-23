import { expect, test } from '@playwright/test';

test('primary public screens fit the required review widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The desktop project covers the explicit viewport matrix.');
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  const viewports = [
    [320, 800], [360, 800], [375, 667], [390, 844], [412, 915], [430, 932],
    [667, 375], [768, 1024], [1024, 768], [1366, 768], [1440, 900],
    [1920, 1080], [2560, 1440], [3840, 2160]
  ] as const;
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/how-to-play', '/pass-the-phone']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      if ([375, 1440, 3840].includes(width)) await page.screenshot({ path: testInfo.outputPath(`moley-${path === '/' ? 'home' : path.slice(1)}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
});
