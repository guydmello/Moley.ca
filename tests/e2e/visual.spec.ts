import { expect, test } from '@playwright/test';

test('primary public screens fit the required review widths', async ({ page, isMobile }, testInfo) => {
  test.skip(Boolean(isMobile), 'The desktop project covers the explicit viewport matrix.');
  await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));
  for (const width of [375, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : width < 1000 ? 1024 : 1000 });
    for (const path of ['/', '/how-to-play', '/pass-the-phone']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`moley-${path === '/' ? 'home' : path.slice(1)}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
});
