import { expect, test, type Page } from '@playwright/test';

type SavedLocalState = {
  schemaVersion: number;
  stage: string;
  settings: Record<string, unknown>;
  boardIds: string[];
  secretWordId: string | null;
  turnOrder: string[];
  currentTurn: number;
  currentClueRound: number;
  completedClueRounds: number;
  players: { id: string; name: string; kind: 'human' | 'bot'; score: number; roundGain: number }[];
  moleIds: string[];
  votes: Record<string, string>;
  result: null | { caughtMoleIds: string[]; correctGuessMoleIds: string[]; gains: Record<string, number> };
  roundScored: boolean;
};

async function savedLocalState(page: Page): Promise<SavedLocalState> {
  return page.evaluate(() => {
    const encoded = localStorage.getItem('moley:local:recovery');
    if (!encoded) throw new Error('Local recovery state is missing.');
    const binary = atob(encoded);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as SavedLocalState;
  });
}

async function playClueTurn(page: Page, clue: string) {
  const bot = page.getByRole('button', { name: /Let .* think/i });
  if (await bot.isVisible().catch(() => false)) { await bot.click(); await page.waitForTimeout(30); }
  else { await page.getByPlaceholder('One meaningful clue…').fill(clue); await page.getByRole('button', { name: /Lock clue/i }).click(); }
}

async function finishRoleHandoff(page: Page) {
  await expect(page.getByRole('heading', { name: /Pass to Alex/i })).toBeVisible();
  await page.getByRole('button', { name: /reveal privately/i }).click();
  await expect(page.getByText(/YOUR SECRET WORD|YOU ARE THE/)).toBeVisible();
  await page.getByRole('button', { name: /Hide & pass on/i }).click();
}

async function finishClues(page: Page) {
  for (let turn = 0; turn < 30; turn++) {
    const nextClueRound = page.getByRole('button', { name: /Start Clue Round/i });
    if (await nextClueRound.isVisible().catch(() => false)) { await nextClueRound.click(); continue; }
    const startDiscussion = page.getByRole('button', { name: 'Start Discussion' });
    if (await startDiscussion.isVisible().catch(() => false)) { await startDiscussion.click(); break; }
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
  if (await page.locator('.local-guess-private').isVisible().catch(() => false)) {
    const botGuess = page.getByRole('button', { name: /Let .* lock a guess/i });
    if (await botGuess.isVisible().catch(() => false)) await botGuess.click();
    else {
      await page.getByRole('button', { name: /I'm /i }).click();
      await page.getByLabel('Final word guess').fill('definitely wrong');
      await page.getByRole('button', { name: /Lock In Guess/i }).click();
    }
    await page.getByRole('button', { name: 'Reveal' }).click();
  }
  await expect(page.getByText(/ROUND \d+ COMPLETE|MATCH COMPLETE/).first()).toBeVisible();
}

test('cached production PWA completes, restores, and rematches a true offline local game', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
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
  await expect(page.getByLabel('Clue rounds before voting')).toHaveValue('2');
  await page.getByLabel('Fast Bots').check();
  await page.getByRole('button', { name: /Start game/i }).click();

  await finishRoleHandoff(page);
  const firstOrder = await page.locator('.local-turn-order li strong').allTextContents();
  await finishClues(page);
  await finishVoteAndRound(page);

  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
  await expect(page.getByText(/ROUND 1 COMPLETE|MATCH COMPLETE/).first()).toBeVisible();

  for (let round = 2; round <= 12; round++) {
    const next = page.getByRole('button', { name: /Start next (?:Game )?Round/i });
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

test('four humans and two bots complete two offline Clue Rounds and a mandatory Final Guess', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'desktop', 'Playwright WebKit cannot reliably reload a service-worker page after offline emulation; Chromium runs the true-offline path.');
  const productionOrigin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8787';
  await page.goto(`${productionOrigin}/local`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();

  const humans = ['Alex', 'Sam', 'Maya', 'Jordan'];
  for (const [index, name] of humans.entries()) await page.getByPlaceholder(`Player ${index + 1}`).fill(name);
  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Add bot' }).click();
  await expect(page.getByLabel('Clue rounds before voting')).toHaveValue('2');
  await expect(page.getByLabel('First to')).toHaveValue('5');
  await page.getByLabel('Fast Bots').check();
  await page.getByRole('button', { name: /Start game locally/i }).click();

  for (const name of humans) {
    await expect(page.getByRole('heading', { name: `Pass to ${name}` })).toBeVisible();
    await page.getByRole('button', { name: /reveal privately/i }).click();
    await page.getByRole('button', { name: /Hide & pass on/i }).click();
  }

  const firstOrder = await page.locator('.local-turn-order li strong').allTextContents();
  expect(firstOrder).toHaveLength(6);
  for (let turn = 0; turn < 6; turn++) await playClueTurn(page, `first pass ${turn}`);
  await expect(page.getByRole('heading', { name: 'Clue Round 1 Complete' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start secret voting/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Clue Round 2' }).click();
  expect(await page.locator('.local-turn-order li strong').allTextContents()).toEqual(firstOrder);

  await playClueTurn(page, 'second pass resume check');
  const nextPlayer = await page.locator('.local-phase-head h1').textContent();
  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
  await expect(page.getByText(/CLUE ROUND 2 OF 2/)).toBeVisible();
  await expect(page.locator('.local-phase-head h1')).toHaveText(nextPlayer ?? '');
  expect(await page.locator('.local-turn-order li strong').allTextContents()).toEqual(firstOrder);
  for (let turn = 1; turn < 6; turn++) await playClueTurn(page, `second pass ${turn}`);

  await expect(page.getByRole('heading', { name: 'All clues are in' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Discussion' }).click();
  await page.getByRole('button', { name: /Start secret voting/i }).click();
  await expect.poll(async () => (await savedLocalState(page)).stage).toBe('voting');
  const voting = await savedLocalState(page);
  const moleId = voting.moleIds[0]!;
  const mole = voting.players.find((player) => player.id === moleId)!;
  const botVoteCounts = Object.values(voting.votes).reduce<Record<string, number>>((counts, target) => ({ ...counts, [target]: (counts[target] ?? 0) + 1 }), {});

  for (const voterName of humans) {
    await page.getByRole('button', { name: `I'm ${voterName}` }).click();
    const voter = voting.players.find((player) => player.name === voterName)!;
    const target = voter.id !== moleId
      ? mole
      : voting.players.filter((player) => player.id !== voter.id).sort((a, b) => (botVoteCounts[a.id] ?? 0) - (botVoteCounts[b.id] ?? 0))[0]!;
    await page.locator('.local-vote-grid button').filter({ hasText: target.name }).click();
  }

  await page.getByRole('button', { name: /Reveal the vote/i }).click();
  await expect(page.locator('.local-guess-private')).toBeVisible();
  const botGuess = page.getByRole('button', { name: /Let .* lock a guess/i });
  if (await botGuess.isVisible().catch(() => false)) await botGuess.click();
  else {
    await page.getByRole('button', { name: `I'm ${mole.name}` }).click();
    await page.getByLabel('Final word guess').fill('definitely wrong');
    await page.getByRole('button', { name: /Lock In Guess/i }).click();
  }
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal' }).click();

  const scored = await savedLocalState(page);
  expect(scored.roundScored).toBe(true);
  expect(scored.result?.caughtMoleIds).toContain(moleId);
  if (scored.result?.correctGuessMoleIds.includes(moleId)) expect(scored.result.gains[moleId]).toBe(1);
  else for (const player of scored.players.filter((candidate) => candidate.id !== moleId)) expect(scored.result?.gains[player.id]).toBe(2);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/')))).toBe(false);
});

test('a cached PWA migrates a mid-round schema-2 save and finishes offline', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'desktop', 'Integrated service-worker and schema migration runs once in Chromium.');
  const productionOrigin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8787';
  await page.goto(`${productionOrigin}/local`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByPlaceholder('Player 1').fill('Alex');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('Fast Bots').check();
  await page.getByRole('button', { name: /Start game locally/i }).click();
  await finishRoleHandoff(page);
  await playClueTurn(page, 'legacy mid-round clue');
  await expect.poll(async () => (await savedLocalState(page)).currentTurn).toBe(1);
  const before = await savedLocalState(page);

  await page.evaluate(() => {
    const encoded = localStorage.getItem('moley:local:recovery')!;
    const binary = atob(encoded);
    const state = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as Record<string, unknown>;
    state.schemaVersion = 2;
    const settings = state.settings as Record<string, unknown>;
    delete settings.requiredClueRoundsBeforeVoting;
    delete settings.haptics;
    delete state.currentClueRound;
    delete state.completedClueRounds;
    delete state.clueHistory;
    delete state.moleFinalGuess;
    delete state.roundScored;
    state.updatedAt = Date.now() + 60_000;
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let nextBinary = '';
    for (const byte of bytes) nextBinary += String.fromCharCode(byte);
    localStorage.setItem('moley:local:recovery', btoa(nextBinary));
  });

  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
  await expect.poll(async () => (await savedLocalState(page)).schemaVersion).toBe(3);
  const migrated = await savedLocalState(page);
  expect(migrated.boardIds).toEqual(before.boardIds);
  expect(migrated.secretWordId).toBe(before.secretWordId);
  expect(migrated.turnOrder).toEqual(before.turnOrder);
  expect(migrated.currentTurn).toBe(before.currentTurn);
  expect(migrated.currentClueRound).toBe(1);
  expect(migrated.completedClueRounds).toBe(0);

  await finishClues(page);
  await finishVoteAndRound(page);
  expect((await savedLocalState(page)).roundScored).toBe(true);
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
