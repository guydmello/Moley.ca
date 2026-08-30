import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { words } from '@moley/word-packs';

type SavedLocalState = {
  updatedAt: number;
  stage: string;
  roundNumber: number;
  players: { id: string; name: string; kind: 'human' | 'bot'; score: number; roundGain: number; moleRounds: number[] }[];
  moleIds: string[];
  boardIds: string[];
  secretWordId: string;
  botMinds: Record<string, unknown>;
  result: null | {
    caughtMoleIds: string[];
    escapedMoleIds: string[];
    correctGuessMoleIds: string[];
    moleGuesses: Record<string, string>;
    gains: Record<string, number>;
  };
  roundScored: boolean;
};

const HUMAN_NAMES = ['Alex', 'Sam', 'Maya', 'Jordan'];

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
}

async function readSaved(page: Page): Promise<SavedLocalState> {
  return page.evaluate(() => {
    const encoded = localStorage.getItem('moley:local:recovery');
    if (!encoded) throw new Error('Local recovery state is missing.');
    const binary = atob(encoded);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as SavedLocalState;
  });
}

async function replaceSaved(page: Page, mutate: (state: SavedLocalState) => void): Promise<void> {
  const state = await readSaved(page);
  mutate(state);
  state.updatedAt = Date.now() + 60_000;
  await page.evaluate((next) => {
    const bytes = new TextEncoder().encode(JSON.stringify(next));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    localStorage.setItem('moley:local:recovery', btoa(binary));
  }, state);
}

async function reloadAndResume(page: Page): Promise<void> {
  await page.reload();
  await page.getByRole('button', { name: /Resume Local Game/i }).click();
}

async function setupForcedMole(page: Page, kind: 'human' | 'bot', auditStages = false) {
  await page.goto('/local');
  for (const [index, name] of HUMAN_NAMES.entries()) await page.getByPlaceholder(`Player ${index + 1}`).fill(name);
  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByLabel('Fast Bots').check();
  await expect(page.getByLabel('Clue rounds before voting')).toHaveValue('2');
  if (auditStages) await expectNoSeriousViolations(page);
  await page.getByRole('button', { name: /Start game locally/i }).click();
  await expect.poll(async () => (await readSaved(page)).stage).toBe('roles');
  const started = await readSaved(page);
  const mole = started.players.find((player) => player.kind === kind)!;
  await replaceSaved(page, (state) => {
    state.moleIds = [mole.id];
    for (const player of state.players) {
      player.moleRounds = player.moleRounds.filter((round) => round !== state.roundNumber);
      if (player.id === mole.id) player.moleRounds.push(state.roundNumber);
    }
  });
  await reloadAndResume(page);
  if (auditStages) await expectNoSeriousViolations(page);
  for (const name of HUMAN_NAMES) {
    await expect(page.getByRole('heading', { name: `Pass to ${name}` })).toBeVisible();
    await page.getByRole('button', { name: /reveal privately/i }).click();
    await page.getByRole('button', { name: /Hide & pass on/i }).click();
  }
  return { mole, secret: words.find((word) => word.id === started.secretWordId)! };
}

async function playClueTurn(page: Page, clue: string): Promise<void> {
  const bot = page.getByRole('button', { name: /Let .* think/i });
  if (await bot.isVisible().catch(() => false)) { await bot.click(); await page.waitForTimeout(30); }
  else { await page.getByPlaceholder('One meaningful clue…').fill(clue); await page.getByRole('button', { name: /Lock clue/i }).click(); }
}

async function finishTwoClueRounds(page: Page, auditStages = false): Promise<void> {
  const order = await page.locator('.local-turn-order li strong').allTextContents();
  expect(order).toHaveLength(5);
  for (let turn = 0; turn < 5; turn++) await playClueTurn(page, `first evidence ${turn}`);
  await expect(page.getByRole('heading', { name: 'Clue Round 1 Complete' })).toBeVisible();
  if (auditStages) await expectNoSeriousViolations(page);
  await expect(page.getByRole('button', { name: /Start secret voting/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Clue Round 2' }).click();
  expect(await page.locator('.local-turn-order li strong').allTextContents()).toEqual(order);
  for (let turn = 0; turn < 5; turn++) await playClueTurn(page, `second evidence ${turn}`);
  await expect(page.getByRole('heading', { name: 'All clues are in' })).toBeVisible();
  if (auditStages) await expectNoSeriousViolations(page);
  await expect(page.getByRole('button', { name: /Start secret voting/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Discussion' }).click();
  if (auditStages) await expectNoSeriousViolations(page);
}

async function voteFor(page: Page, moleId: string, catchMole: boolean, auditStages = false): Promise<void> {
  await page.getByRole('button', { name: /Start secret voting/i }).click();
  if (auditStages) await expectNoSeriousViolations(page);
  const voting = await readSaved(page);
  const mole = voting.players.find((player) => player.id === moleId)!;
  const bot = voting.players.find((player) => player.kind === 'bot')!;
  for (const voterName of HUMAN_NAMES) {
    await page.getByRole('button', { name: `I'm ${voterName}` }).click();
    const voter = voting.players.find((player) => player.name === voterName)!;
    const target = catchMole
      ? voter.id === mole.id ? voting.players.find((player) => player.id !== voter.id && player.kind === 'human')! : mole
      : bot;
    await page.locator('.local-vote-grid button').filter({ hasText: target.name }).click();
  }
  await page.getByRole('button', { name: /Reveal the vote/i }).click();
}

async function expectPrivateGuessStillHidden(page: Page): Promise<void> {
  await expect(page.getByText(/The secret word was/i)).toHaveCount(0);
  const publicSnapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('moley:local:public-display:'));
    return key ? JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown> : null;
  });
  expect(publicSnapshot?.result).toBeNull();
  expect(JSON.stringify(publicSnapshot)).not.toContain('moleFinalGuess');
}

async function expectScore(page: Page, moleId: string, correct: boolean): Promise<void> {
  await expect.poll(async () => (await readSaved(page)).roundScored).toBe(true);
  const scored = await readSaved(page);
  expect(scored.result?.caughtMoleIds).toContain(moleId);
  expect(scored.result?.correctGuessMoleIds.includes(moleId)).toBe(correct);
  expect(scored.result?.gains[moleId]).toBe(correct ? 1 : 0);
  for (const player of scored.players.filter((candidate) => candidate.id !== moleId)) expect(scored.result?.gains[player.id]).toBe(correct ? 0 : 2);
}

for (const correct of [true, false]) test(`caught human Mole locks one ${correct ? 'correct' : 'incorrect'} private Final Guess and scores once`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Deterministic Local Final Guess acceptance runs once in Chromium.');
  const auditStages = !correct;
  const { mole, secret } = await setupForcedMole(page, 'human', auditStages);
  await finishTwoClueRounds(page, auditStages);
  await voteFor(page, mole.id, true, auditStages);
  await expect(page.locator('.local-guess-private')).toBeVisible();
  if (auditStages) await expectNoSeriousViolations(page);
  await expectPrivateGuessStillHidden(page);

  await reloadAndResume(page);
  await expect(page.getByRole('button', { name: `I'm ${mole.name}` })).toBeVisible();
  await page.getByRole('button', { name: `I'm ${mole.name}` }).click();
  await page.getByLabel('Final word guess').fill(correct ? secret.display : 'definitely incorrect');
  await page.getByRole('button', { name: /Lock In Guess/i }).click();
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  if (auditStages) await expectNoSeriousViolations(page);
  await expect(page.getByLabel('Final word guess')).toHaveCount(0);
  await expectPrivateGuessStillHidden(page);

  await reloadAndResume(page);
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  await expect(page.getByLabel('Final word guess')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expectScore(page, mole.id, correct);
  await expect(page.getByText(/The secret word was/i)).toBeVisible();
  if (auditStages) await expectNoSeriousViolations(page);
});

for (const correct of [true, false]) test(`caught Bot Mole locks one ${correct ? 'correct' : 'incorrect'} deduction and scores once`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Deterministic Local Final Guess acceptance runs once in Chromium.');
  const { mole, secret } = await setupForcedMole(page, 'bot');
  await finishTwoClueRounds(page);
  await voteFor(page, mole.id, true);
  await expect(page.locator('.local-guess-private')).toBeVisible();
  await expectPrivateGuessStillHidden(page);

  const guessing = await readSaved(page);
  const candidateId = correct ? guessing.secretWordId : guessing.boardIds.find((id) => id !== guessing.secretWordId)!;
  const candidate = words.find((word) => word.id === candidateId)!;
  await replaceSaved(page, (state) => { state.botMinds[mole.id] = { candidates: [{ word: candidate.display, confidence: 100 }], suspicion: {} }; });
  await reloadAndResume(page);
  await page.evaluate(() => {
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: <T extends ArrayBufferView>(array: T) => {
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
      return array;
    } });
  });
  await page.getByRole('button', { name: /Let .* lock a guess/i }).click();
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  await expectPrivateGuessStillHidden(page);
  const locked = await readSaved(page);
  expect(locked.result).toBeNull();

  await reloadAndResume(page);
  await expect(page.getByRole('heading', { name: 'Guess Locked' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expectScore(page, mole.id, correct);
  expect((await readSaved(page)).result?.moleGuesses[mole.id]).toBe(candidate.display);
  if (correct) expect(candidate.display).toBe(secret.display);
});

test('an escaped Mole receives two points without entering Final Guess', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Deterministic Local escape acceptance runs once in Chromium.');
  const { mole } = await setupForcedMole(page, 'human');
  await finishTwoClueRounds(page);
  await voteFor(page, mole.id, false);
  await expect(page.locator('.local-guess-private')).toHaveCount(0);
  await expect.poll(async () => (await readSaved(page)).roundScored).toBe(true);
  const scored = await readSaved(page);
  expect(scored.result?.escapedMoleIds).toContain(mole.id);
  expect(scored.result?.gains[mole.id]).toBe(2);
  for (const player of scored.players.filter((candidate) => candidate.id !== mole.id)) expect(scored.result?.gains[player.id]).toBe(0);
});
