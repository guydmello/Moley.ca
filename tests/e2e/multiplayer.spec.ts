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
  for (const page of [host, player]) await page.addInitScript(() => localStorage.setItem('moley:tutorial', 'done'));

  await host.goto('/');
  await host.getByRole('button', { name: /Create game/i }).first().click();
  await host.getByPlaceholder('e.g. Guy').fill('Alex');
  await host.getByRole('button', { name: 'Online' }).click();
  await host.getByRole('button', { name: /Create my room/i }).click();
  await expect(host).toHaveURL(/\/play\//);
  const code = host.url().split('/').pop()!;

  await player.goto(`/join/${code}`);
  await player.getByPlaceholder('e.g. Guy').fill('Sam');
  await player.getByRole('button', { name: /Join game/i }).click();
  await expect(player).toHaveURL(new RegExp(`/play/${code}`));
  await expect(host.getByText('Sam', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: /Add bot/i }).click();
  await host.getByRole('button', { name: /Add bot/i }).click();
  await host.getByRole('button', { name: /Start game/i }).click();
  await Promise.all([ready(host), ready(player)]);
  await expect(host.locator('.turn-rail')).toBeVisible({ timeout: 15_000 });

  await player.reload();
  await expect(player.locator('.turn-rail')).toBeVisible({ timeout: 15_000 });
  await expect(player.getByText(/Digging a new tunnel/)).toBeHidden({ timeout: 15_000 });

  await hostContext.close();
  await expect(player.getByText(/Sam is now the host/i)).toBeVisible({ timeout: 20_000 });
  await playerContext.close();
});
