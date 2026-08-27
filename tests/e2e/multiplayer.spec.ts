import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.getByRole('button', { name: /HOLD TO REVEAL/i }).click();
  await page.getByRole('button', { name: /I’ve seen my role/i }).click();
}

test('two humans and two bots create, join, receive private roles, and reconnect', async ({ browser }) => {
  const hostContext: BrowserContext = await browser.newContext();
  const playerContext: BrowserContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const socketUrls: string[] = [];
  host.on('websocket', (socket) => socketUrls.push(socket.url()));
  player.on('websocket', (socket) => socketUrls.push(socket.url()));
  for (const page of [host, player]) await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));

  await host.goto('/');
  await host.getByRole('button', { name: /Create game/i }).first().click();
  await host.getByPlaceholder('e.g. Guy').fill('Alex');
  await host.getByRole('button', { name: 'Online' }).click();
  await host.getByRole('button', { name: /Create my room/i }).click();
  await expect(host).toHaveURL(/\/play\//);
  const code = host.url().split('/').pop()!;
  const hostSessionBeforeDisplay = await host.evaluate((roomCode) => localStorage.getItem(`moley:session:${roomCode}`), code);

  const display = await hostContext.newPage();
  display.on('websocket', (socket) => socketUrls.push(socket.url()));
  await display.goto(`/display/${code}`);
  await expect(display.getByRole('heading', { name: /Scan to join/i })).toBeVisible();
  expect(await host.evaluate((roomCode) => localStorage.getItem(`moley:session:${roomCode}`), code)).toBe(hostSessionBeforeDisplay);

  await player.goto(`/join/${code}`);
  await player.getByPlaceholder('e.g. Guy').fill('Sam');
  await player.getByRole('button', { name: /Join game/i }).click();
  await expect(player).toHaveURL(new RegExp(`/play/${code}`));
  await expect(host.getByText('Sam', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: /Add bot/i }).click();
  await host.getByRole('button', { name: /Add bot/i }).click();
  await host.getByRole('button', { name: /Start game/i }).click();
  await expect(display.getByRole('heading', { name: /Roles are being checked/i })).toBeVisible();
  await expect(display.getByText(/YOUR SECRET WORD|YOU ARE THE MOLE/i)).toBeHidden();
  await Promise.all([ready(host), ready(player)]);
  await expect(host.locator('.turn-rail')).toBeVisible({ timeout: 15_000 });
  await expect(host.locator('.shared-word-board span')).toHaveCount(25);
  await expect(player.locator('.shared-word-board span')).toHaveCount(25);
  await expect(display.locator('.shared-word-board span')).toHaveCount(25);

  const hostBoard = await host.locator('.shared-word-board span').allTextContents();
  const playerBoard = await player.locator('.shared-word-board span').allTextContents();
  const displayBoard = await display.locator('.shared-word-board span').allTextContents();
  expect(hostBoard).toHaveLength(25);
  expect(new Set(hostBoard.map((word) => word.normalize('NFKD').toLocaleLowerCase('en-CA').replace(/[^a-z0-9]+/g, ' ').trim())).size).toBe(25);
  expect(playerBoard).toEqual(hostBoard);
  expect(displayBoard).toEqual(hostBoard);

  await player.reload();
  await expect(player.locator('.turn-rail')).toBeVisible({ timeout: 15_000 });
  await expect(player.locator('.shared-word-board span')).toHaveText(hostBoard);
  await expect(player.getByText(/Digging a new tunnel/)).toBeHidden({ timeout: 15_000 });

  await display.reload();
  await expect(display.locator('.shared-word-board span')).toHaveText(hostBoard);
  await expect(display.getByText(/YOUR SECRET WORD|YOU ARE THE MOLE/i)).toBeHidden();
  const roomSocketUrls = socketUrls.filter((url) => new URL(url).pathname.includes('/api/rooms/'));
  expect(roomSocketUrls.length).toBeGreaterThanOrEqual(3);
  expect(roomSocketUrls.every((url) => !new URL(url).searchParams.has('token'))).toBe(true);

  await hostContext.close();
  await expect(player.getByText(/Sam is now the host/i)).toBeVisible({ timeout: 20_000 });
  await playerContext.close();
});
