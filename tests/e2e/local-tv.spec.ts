import { expect, test, type Page } from '@playwright/test';

async function openTv(page: Page): Promise<Page> {
  const controls = page.getByLabel('Local host controls');
  const open = page.getByRole('button', { name: 'Open TV Display' });
  if (!await open.isVisible().catch(() => false)) await controls.click();
  const [display] = await Promise.all([page.waitForEvent('popup'), open.click()]);
  await display.waitForLoadState('domcontentloaded');
  return display;
}

test('Local TV attaches, reloads, detaches, and reconnects with public-only state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The cross-window transport runs once in desktop Chromium.');
  await page.goto('/local');
  await page.getByPlaceholder('Player 1').fill('Alex');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: /Start game/i }).click();

  let display = await openTv(page);
  await expect(display.getByRole('heading', { name: 'Roles are being checked.' })).toBeVisible();
  await expect(display.getByText(/YOUR SECRET WORD|YOU ARE THE MOLE|secretWordId|moleIds/i)).toBeHidden();

  await page.getByRole('button', { name: /reveal privately/i }).click();
  await expect(page.getByText(/YOUR SECRET WORD|YOU ARE THE/)).toBeVisible();
  await expect(display.getByText(/YOUR SECRET WORD|YOU ARE THE MOLE/i)).toBeHidden();
  const serializedPublicState = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('moley:local:public-display:'));
    return key ? localStorage.getItem(key) : null;
  });
  expect(serializedPublicState).not.toBeNull();
  for (const field of ['secretWordId', 'moleIds', 'votes', 'botMinds', 'botClueMemory']) expect(serializedPublicState).not.toContain(`"${field}"`);

  await page.getByRole('button', { name: /Hide & pass on/i }).click();
  await expect(page.locator('.shared-word-board span')).toHaveCount(25);
  const hostBoard = await page.locator('.shared-word-board span').allTextContents();
  await expect(display.locator('.shared-word-board span')).toHaveText(hostBoard);
  expect(hostBoard).toHaveLength(25);

  await display.reload();
  await expect(display.locator('.shared-word-board span')).toHaveText(hostBoard);
  await expect(display.getByText(/YOUR SECRET WORD|YOU ARE THE MOLE/i)).toBeHidden();

  await display.close();
  await expect(page.locator('.shared-word-board span')).toHaveText(hostBoard);
  display = await openTv(page);
  await expect(display.locator('.shared-word-board span')).toHaveText(hostBoard);
  await expect(display.getByText('TV DISPLAY · PUBLIC ONLY')).toBeVisible();
  await display.close();
});
