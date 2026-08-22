import { describe, expect, it, vi } from 'vitest';
import { BotAI } from '../../apps/worker/src/ai';
import type { Env } from '../../apps/worker/src/types';
import type { WordEntry } from '@moley/word-packs';

const word: WordEntry = { id: 'fruit-apple', display: 'Apple', aliases: ['apples'], category: 'Fruits', difficulty: 'easy', tags: ['fruit'], safeBotClues: ['orchard'], familySafe: true };

const envWith = (run: (...args: unknown[]) => unknown) => ({ AI: { run }, AI_MODEL: 'test' }) as unknown as Env;

describe('Workers AI bot fallback', () => {
  it('accepts a safe structured clue', async () => {
    const ai = new BotAI(envWith(vi.fn().mockResolvedValue({ response: '{"clue":"orchard"}' })));
    await expect(ai.improveInnocentClue(word, [], 40)).resolves.toBe('orchard');
  });

  it.each([
    ['malformed JSON', { response: 'not-json' }],
    ['secret leak', { response: '{"clue":"apple pie"}' }],
    ['missing response', {}],
    ['quota failure', new Error('quota exceeded')]
  ])('falls back on %s', async (_name, value) => {
    const run = value instanceof Error ? vi.fn().mockRejectedValue(value) : vi.fn().mockResolvedValue(value);
    const ai = new BotAI(envWith(run));
    await expect(ai.improveInnocentClue(word, ['red'], 40)).resolves.toBeNull();
  });

  it('works when AI is not bound', async () => {
    const ai = new BotAI({} as Env);
    await expect(ai.improveInnocentClue(word, [], 40)).resolves.toBeNull();
  });
});
