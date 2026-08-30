import { describe, expect, it } from 'vitest';
import { autoMoleCount, buildWordBoard, canTransition, customWordEntries, dedupeWords, filterWordCatalog, findWinners, moleBotGuess, newRoundTurnOrder, normalizeWordKey, rankVotes, scoreRound, validateConfiguration } from './index';
import { defaultSettings } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';
import { words } from '@moley/word-packs';

const word: WordEntry = { id: 'fruit-apple', display: 'Apple', aliases: ['apples'], category: 'Fruits', difficulty: 'easy', tags: ['fruit'], safeBotClues: ['orchard'], familySafe: true };

describe('state machine', () => {
  it('allows legal and rejects illegal transitions', () => {
    expect(canTransition('ROOM_LOBBY', 'ROUND_SETUP')).toBe(true);
    expect(canTransition('ROOM_LOBBY', 'VOTING')).toBe(false);
    expect(canTransition('VOTING', 'VOTE_REVEAL')).toBe(true);
  });
});

describe('mole count and voting', () => {
  it.each([[4, 1], [7, 1], [8, 2], [13, 2], [14, 3], [20, 3], [100, 15]])('selects %i seats -> %i moles', (seats, expected) => {
    expect(autoMoleCount(seats)).toBe(expected);
  });
  it('detects a tie at the accusation cutoff', () => {
    const result = rankVotes(['a', 'b', 'c', 'd'], { one: 'a', two: 'b', three: 'c', four: 'a' }, 2);
    expect(result.accusedIds).toEqual(['a']);
    expect(result.tiedIds).toEqual(['b', 'c']);
  });
});

describe('scoring', () => {
  it('awards an escaped mole', () => {
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a'], accusedIds: ['b'], guesses: {}, word }).gains).toEqual({ a: 2, b: 0, c: 0, d: 0 });
  });
  it('awards a correct caught mole', () => {
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a'], accusedIds: ['a'], guesses: { a: { guess: ' APPLE! ' } }, word }).gains.a).toBe(1);
  });
  it('awards innocents only when every mole is caught and no guess is correct', () => {
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a', 'b'], accusedIds: ['a', 'b'], guesses: { a: { guess: 'pear' }, b: { guess: 'plum' } }, word }).gains).toEqual({ a: 0, b: 0, c: 2, d: 2 });
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a', 'b'], accusedIds: ['a'], guesses: { a: { guess: 'pear' } }, word }).gains.c).toBe(0);
  });
  it('scores mixed multi-Mole outcomes without leaking points across sides', () => {
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a', 'b'], accusedIds: ['a'], guesses: { a: { guess: 'apple' } }, word }).gains).toEqual({ a: 1, b: 2, c: 0, d: 0 });
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a', 'b'], accusedIds: ['a', 'b'], guesses: { a: { guess: 'apple' }, b: { guess: 'pear' } }, word }).gains).toEqual({ a: 1, b: 0, c: 0, d: 0 });
    expect(scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a', 'b'], accusedIds: ['a', 'b'], guesses: {}, word }).gains).toEqual({ a: 0, b: 0, c: 2, d: 2 });
  });
  it('treats a caught Mole timeout or missing guess as incorrect', () => {
    const result = scoreRound({ playerIds: ['a', 'b', 'c', 'd'], moleIds: ['a'], accusedIds: ['a'], guesses: {}, word });
    expect(result.gains).toEqual({ a: 0, b: 2, c: 2, d: 2 });
    expect(result.moleGuesses).toEqual({ a: 'No guess' });
  });
  it('supports co-winners and endless mode', () => {
    expect(findWinners({ a: 5, b: 5, c: 3 }, defaultSettings)).toEqual(['a', 'b']);
    expect(findWinners({ a: 5, b: 4 }, defaultSettings)).toEqual(['a']);
    expect(findWinners({ a: 7, b: 6, c: 4 }, defaultSettings)).toEqual(['a']);
    expect(findWinners({ a: 7, b: 7, c: 6 }, defaultSettings)).toEqual(['a', 'b']);
    expect(findWinners({ a: 50 }, { ...defaultSettings, targetScore: null })).toEqual([]);
  });
});

describe('canonical word boards', () => {
  const catalog = customWordEntries([
    ...Array.from({ length: 120 }, (_, index) => `Distinct Word ${index}`),
    'Apple', ' APPLES ', 'Àpple!', 'Berry', 'Berries'
  ]);

  it.each([5, 6, 7, 8, 9, 10])('builds an exact normalized-unique %i×%i board containing the secret', (size) => {
    const secret = catalog[17]!;
    const board = buildWordBoard(catalog, size, secret, () => 0.42);
    expect(board).toHaveLength(size ** 2);
    expect(board).toContainEqual(secret);
    expect(new Set(board.map((entry) => normalizeWordKey(entry.display))).size).toBe(size ** 2);
  });

  it('collapses punctuation, Unicode, and conservative plural attacks', () => {
    expect(dedupeWords(catalog).filter((entry) => normalizeWordKey(entry.display) === 'apple')).toHaveLength(1);
    expect(dedupeWords(catalog).filter((entry) => normalizeWordKey(entry.display) === 'berry')).toHaveLength(1);
  });

  it.each([0, 4, 11, 5.5, Number.NaN])('rejects invalid board size %s independently of the UI', (size) => {
    expect(() => buildWordBoard(catalog, size)).toThrow(/between 5 and 10/i);
  });

  it('never repeats an entire order when the roster is unchanged', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const first = newRoundTurnOrder(ids, [], [], () => 0.6);
    const second = newRoundTurnOrder(ids, first, [first[0]!], () => 0.6);
    expect(second).not.toEqual(first);
    expect(new Set(second)).toEqual(new Set(ids));
  });

  it('allows an explicit curated bot fallback without weakening board validation', () => {
    const unsupported = customWordEntries(Array.from({ length: 25 }, (_, index) => `Private ${index}`));
    const review = validateConfiguration({ ...defaultSettings, boardEnabled: true }, { availableWords: unsupported, fallbackBotWords: words, botCount: 2, offline: false });
    expect(review.errors).toEqual([]);
    expect(review.warnings.join(' ')).toMatch(/curated bot-supported secret/i);
  });

  it('samples 300 production boards without duplicates or family-filter violations', () => {
    const productionCatalog = filterWordCatalog(words, defaultSettings);
    let value = 20260827;
    const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
    for (let index = 0; index < 300; index++) {
      const size = 5 + (index % 6);
      const secret = productionCatalog[(index * 37) % productionCatalog.length]!;
      const board = buildWordBoard(productionCatalog, size, secret, random);
      expect(board).toHaveLength(size ** 2);
      expect(board).toContainEqual(secret);
      expect(new Set(board.map((entry) => normalizeWordKey(entry.display))).size).toBe(board.length);
      expect(board.every((entry) => entry.familySafe)).toBe(true);
    }
  });
});

describe('Mole bot information boundary', () => {
  it('guesses only from supplied candidates and observed candidate confidence', () => {
    const candidates = words.filter((entry) => ['Apple', 'Paris', 'Hammer'].includes(entry.display));
    const guess = moleBotGuess({ candidates: [{ word: 'Paris', confidence: 0.9 }], suspicion: {} }, candidates, 'sneaky', () => 0);
    expect(guess).toBe('Paris');
    expect(candidates.map((entry) => entry.display)).toContain(guess);
  });
});
