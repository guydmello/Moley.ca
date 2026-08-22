import { describe, expect, it } from 'vitest';
import { autoMoleCount, canTransition, findWinners, rankVotes, scoreRound } from './index';
import { defaultSettings } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';

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
  it('supports co-winners and endless mode', () => {
    expect(findWinners({ a: 5, b: 5, c: 3 }, defaultSettings)).toEqual(['a', 'b']);
    expect(findWinners({ a: 50 }, { ...defaultSettings, targetScore: null })).toEqual([]);
  });
});
