import { describe, expect, it } from 'vitest';
import { botSupportedWords, words } from '@moley/word-packs';
import {
  advanceLocalRole, beginLocalVoting, buildLocalCatalog, createLocalGame, createLocalPlayer, fairTurnOrder,
  finishLocalRound, innocentBotClue, localSettingsForPreset, playLocalClue,
  resolveLocalVoting, startLocalRound, submitLocalVote, validateLocalState
} from './index';

function seeded(seed = 1): () => number {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
}

function roster(humans = 2, bots = 4) {
  const random = seeded(44);
  return [
    ...Array.from({ length: humans }, (_, index) => createLocalPlayer(`Human ${index + 1}`, 'human', random)),
    ...Array.from({ length: bots }, (_, index) => createLocalPlayer(`Bot ${index + 1}`, 'bot', random))
  ];
}

describe('local round order', () => {
  it('contains every active human and bot exactly once and excludes inactive seats', () => {
    const players = roster();
    players[2]!.active = false;
    const state = startLocalRound(createLocalGame(players, localSettingsForPreset('local-bots'), seeded(2)), words, seeded(3));
    expect(state.turnOrder).toHaveLength(5);
    expect(new Set(state.turnOrder).size).toBe(5);
    expect(state.turnOrder).toEqual(expect.arrayContaining(players.filter((player) => player.active).map((player) => player.id)));
    expect(state.turnOrder).not.toContain(players[2]!.id);
    expect(state.players.filter((player) => player.active && player.kind === 'bot').every((player) => state.turnOrder.includes(player.id))).toBe(true);
    expect(state.players.filter((player) => player.active && player.kind === 'human').every((player) => state.turnOrder.includes(player.id))).toBe(true);
  });

  it('softly avoids repeated first seats without becoming a strict rotation', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const orders = Array.from({ length: 40 }, (_, index) => fairTurnOrder(ids, index ? ['a', 'a'] : [], seeded(index + 1)));
    expect(orders.every((order) => new Set(order).size === ids.length)).toBe(true);
    expect(new Set(orders.map((order) => order.join(','))).size).toBeGreaterThan(8);
    expect(fairTurnOrder(ids, ['a', 'a'], () => 0.99)[0]).toBe('a');
  });

  it('stores and validates the current order without reshuffling', () => {
    const state = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-classic'), seeded(9)), words, seeded(10));
    const restored = JSON.parse(JSON.stringify(state)) as unknown;
    expect(validateLocalState(restored, words)).toBe(true);
    expect((restored as typeof state).turnOrder).toEqual(state.turnOrder);
  });

  it('prefers bot-supported metadata while deduplicating display words', () => {
    const catalog = buildLocalCatalog(words, []);
    expect(catalog.filter((word) => word.display === 'Apple')).toHaveLength(1);
    expect(catalog.find((word) => word.display === 'Apple')?.botEnabled).toBe(true);
  });
});

describe('deterministic bot clues', () => {
  it.each(['Apple', 'Hockey', 'Paris', 'Penguin', 'Hammer'])('%s returns an approved semantic clue', (display) => {
    const word = botSupportedWords.find((entry) => entry.display === display)!;
    const approved = [...word.botClues!.direct, ...word.botClues!.medium, ...word.botClues!.subtle, ...(word.relatedConcepts ?? []), ...word.tags, word.category];
    expect(approved).toContain(innocentBotClue(word, [], 'normal', seeded(4), 'detective'));
  });

  it('reserves five normalized unique clues for five innocent bots', () => {
    const word = botSupportedWords.find((entry) => entry.display === 'Apple')!;
    const clues: string[] = [];
    for (let index = 0; index < 5; index++) clues.push(innocentBotClue(word, clues, 'normal', seeded(index + 20), 'creative'));
    const normalized = clues.map((clue) => clue.toLocaleLowerCase('en-CA').replace(/s$/, ''));
    expect(new Set(normalized).size).toBe(5);
    expect(clues.every((clue) => !['thing', 'nice', 'object', 'random'].includes(clue.toLocaleLowerCase('en-CA')))).toBe(true);
  });

  it('varies clue style by difficulty and personality', () => {
    const word = botSupportedWords.find((entry) => entry.display === 'Apple')!;
    const easy = new Set(Array.from({ length: 12 }, (_, index) => innocentBotClue(word, [], 'easy', seeded(index + 2), 'literal')));
    const sneaky = new Set(Array.from({ length: 12 }, (_, index) => innocentBotClue(word, [], 'sneaky', seeded(index + 40), 'creative')));
    expect([...easy].some((clue) => word.botClues!.direct.includes(clue))).toBe(true);
    expect([...sneaky].some((clue) => word.botClues!.subtle.includes(clue))).toBe(true);
  });
});

describe('complete offline local engine', () => {
  it.each([5, 6, 7, 8, 9, 10] as const)('builds a unique %i×%i board', (boardSize) => {
    const settings = { ...localSettingsForPreset('offline-cottage'), boardSize };
    const state = startLocalRound(createLocalGame(roster(1, 4), settings, seeded(boardSize)), words, seeded(boardSize + 50));
    expect(state.boardIds).toHaveLength(boardSize ** 2);
    expect(new Set(state.boardIds).size).toBe(boardSize ** 2);
  });

  it('plays 50 bot-heavy rounds and rematches without backend or AI', () => {
    const random = seeded(8080);
    const settings = { ...localSettingsForPreset('offline-cottage'), boardSize: 10 as const, targetScore: 999 };
    let state = createLocalGame(roster(1, 10), settings, random);
    const startedAt = performance.now();
    for (let round = 0; round < 50; round++) {
      state = startLocalRound(state, words, random);
      state = advanceLocalRole(state);
      while (state.stage === 'clues') {
        const current = state.players.find((player) => player.id === state.turnOrder[state.currentTurn])!;
        state = playLocalClue(state, words, current.kind === 'human' ? `human clue ${round}` : undefined, random);
      }
      state = beginLocalVoting(state, words, random);
      const human = state.players.find((player) => player.active && player.kind === 'human')!;
      const target = state.players.find((player) => player.active && player.id !== human.id)!;
      state = submitLocalVote(state, human.id, target.id);
      state = resolveLocalVoting(state, words, random);
      if (state.stage === 'guess') state = finishLocalRound(state, words, state.boardIds.find((id) => id !== state.secretWordId), random);
      expect(['result', 'match-complete']).toContain(state.stage);
    }
    expect(state.roundNumber).toBe(50);
    expect(state.botClueMemory && Object.values(state.botClueMemory).every((clues) => clues.length <= 19)).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(2500);
  });
});
