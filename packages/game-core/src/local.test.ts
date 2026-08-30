import { describe, expect, it } from 'vitest';
import { botSupportedWords, words } from '@moley/word-packs';
import {
  advanceLocalRole, beginLocalVoting, buildLocalCatalog, createLocalGame, createLocalPlayer, fairTurnOrder,
  finishLocalRound, innocentBotClue, localSettingsForPreset, lockLocalMoleGuess, migrateLocalState, normalizeClueKey, playLocalClue,
  resolveLocalVoting, startLocalRound, submitLocalVote, toLocalPublicDisplay, validateLocalPublicDisplay, validateLocalRoster, validateLocalState
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
    expect(word.botClues!.direct).toContain(innocentBotClue(word, [], 'easy', () => 0, 'literal'));
    expect(word.botClues!.subtle).toContain(innocentBotClue(word, [], 'sneaky', () => 0, 'creative'));
  });

  it('keeps Classic normal clues away from giveaway-level direct Dog clues', () => {
    const dog = botSupportedWords.find((entry) => entry.display === 'Dog')!;
    const normal = Array.from({ length: 20 }, (_, index) => innocentBotClue(dog, [], 'normal', seeded(index + 120), 'detective'));
    expect(normal.every((clue) => !dog.botClues!.direct.includes(clue))).toBe(true);
    expect(normal.every((clue) => [...dog.botClues!.medium, ...dog.botClues!.subtle].includes(clue))).toBe(true);
  });

  it('keeps a seeded 1,425-clue Normal-mode audit curated, indirect, and duplicate-free', () => {
    const random = seeded(20260830);
    let generated = 0;
    for (const word of botSupportedWords) {
      for (let run = 0; run < 25; run++) {
        const used: string[] = [];
        for (let clueRound = 0; clueRound < 3; clueRound++) {
          const clue = innocentBotClue(word, used, 'normal', random, 'detective');
          expect(word.botClues!.direct).not.toContain(clue);
          expect([...word.botClues!.medium, ...word.botClues!.subtle]).toContain(clue);
          expect(used.map(normalizeClueKey)).not.toContain(normalizeClueKey(clue));
          used.push(clue);
          generated++;
        }
      }
    }
    expect(botSupportedWords).toHaveLength(19);
    expect(generated).toBe(1_425);
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
    const settings = { ...localSettingsForPreset('offline-cottage'), boardSize: 10 as const, targetScore: 100 };
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
      if (state.stage === 'guess') {
        const mole = state.players.find((player) => state.moleIds.includes(player.id) && state.accusedIds.includes(player.id));
        state = lockLocalMoleGuess(state, words, mole?.kind === 'human' ? 'definitely wrong' : undefined, random);
        state = finishLocalRound(state, words);
      }
      expect(['result', 'match-complete']).toContain(state.stage);
    }
    expect(state.roundNumber).toBe(50);
    expect(state.botClueMemory && Object.values(state.botClueMemory).every((clues) => clues.length <= 19)).toBe(true);
    // Shared CI runners are materially slower than local development machines;
    // keep this as a runaway-regression guard rather than a hardware benchmark.
    expect(performance.now() - startedAt).toBeLessThan(7500);
  });

  it('uses a curated bot secret fallback while keeping selected pack words on the board', () => {
    const settings = { ...localSettingsForPreset('local-bots'), boardSize: 5 as const, categories: ['Vegetables', 'Candy'] };
    const state = startLocalRound(createLocalGame(roster(1, 3), settings, seeded(72)), words, seeded(73));
    expect(words.find((entry) => entry.id === state.secretWordId)?.botEnabled).toBe(true);
    expect(state.boardIds).toContain(state.secretWordId);
    expect(state.boardIds).toHaveLength(25);
  });
});

describe('local persistence and public projection', () => {
  it('migrates a v2 save without losing its private round, board, or order', () => {
    const state = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-bots'), seeded(81)), words, seeded(82));
    const legacy = structuredClone(state) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    delete (legacy.settings as Record<string, unknown>).haptics;
    delete (legacy.settings as Record<string, unknown>).requiredClueRoundsBeforeVoting;
    delete legacy.currentClueRound;
    delete legacy.completedClueRounds;
    delete legacy.clueHistory;
    delete legacy.moleFinalGuess;
    delete legacy.roundScored;
    const migrated = migrateLocalState(legacy, words);
    expect(migrated?.schemaVersion).toBe(3);
    expect(migrated?.settings.haptics).toBe(true);
    expect(migrated?.secretWordId).toBe(state.secretWordId);
    expect(migrated?.moleIds).toEqual(state.moleIds);
    expect(migrated?.boardIds).toEqual(state.boardIds);
    expect(migrated?.turnOrder).toEqual(state.turnOrder);
    expect(validateLocalState(migrated, words)).toBe(true);
  });

  it('migrates representative schema-2 stages without unlocking voting early', () => {
    const random = seeded(83);
    let clues = startLocalRound(createLocalGame(roster(2, 2), localSettingsForPreset('local-classic'), random), words, random);
    while (clues.stage === 'roles') clues = advanceLocalRole(clues);
    const midClues = playLocalClue(clues, words, clues.players.find((player) => player.id === clues.turnOrder[0])?.kind === 'human' ? 'legacy clue' : undefined, random);
    let discussion = midClues;
    while (discussion.stage === 'clues') {
      const current = discussion.players.find((player) => player.id === discussion.turnOrder[discussion.currentTurn])!;
      discussion = playLocalClue(discussion, words, current.kind === 'human' ? `legacy ${discussion.currentTurn}` : undefined, random);
    }
    const voting = beginLocalVoting(discussion, words, random);
    const nonMole = voting.players.find((player) => player.active && !voting.moleIds.includes(player.id))!;
    const alternate = voting.players.find((player) => player.active && player.id !== nonMole.id)!;
    const escaped = resolveLocalVoting({
      ...voting,
      votes: Object.fromEntries(voting.players.filter((player) => player.active).map((player) => [player.id, player.id === nonMole.id ? alternate.id : nonMole.id]))
    }, words, random);
    expect(escaped.stage).toBe('result');

    const cases = [
      ['before clues', { ...clues, stage: 'roles' as const, roleIndex: 0 }, 0],
      ['mid clue round', midClues, 0],
      ['between legacy passes', { ...clues, currentTurn: 0, clues: {} }, 0],
      ['discussion', discussion, 2],
      ['voting', voting, 2],
      ['round result', escaped, 2]
    ] as const;

    for (const [label, state, expectedCompleted] of cases) {
      const legacy = structuredClone(state) as unknown as Record<string, unknown>;
      legacy.schemaVersion = 2;
      delete (legacy.settings as Record<string, unknown>).requiredClueRoundsBeforeVoting;
      delete legacy.currentClueRound;
      delete legacy.completedClueRounds;
      delete legacy.clueHistory;
      delete legacy.moleFinalGuess;
      delete legacy.roundScored;
      const migrated = migrateLocalState(legacy, words);
      expect(migrated, label).not.toBeNull();
      expect(migrated?.completedClueRounds, label).toBe(expectedCompleted);
      expect(migrated?.turnOrder, label).toEqual(state.turnOrder);
      expect(migrated?.boardIds, label).toEqual(state.boardIds);
      if (expectedCompleted === 0) expect(() => beginLocalVoting({ ...migrated!, stage: 'discussion' }, words), label).toThrow(/locked/i);
    }
  });

  it('fails closed on damaged identities and unsupported schema versions', () => {
    const state = createLocalGame(roster(), localSettingsForPreset('local-classic'), seeded(90));
    const duplicate = structuredClone(state);
    duplicate.players[1]!.id = duplicate.players[0]!.id;
    expect(migrateLocalState(duplicate, words)).toBeNull();
    expect(migrateLocalState({ ...state, schemaVersion: 999 }, words)).toBeNull();
    expect(validateLocalRoster([{ ...state.players[0]!, name: ' Alex ' }, { ...state.players[1]!, name: 'Alex' }])).not.toEqual([]);
  });

  it('projects only allowlisted public TV fields before reveal', () => {
    const state = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-bots'), seeded(91)), words, seeded(92));
    state.votes[state.players[0]!.id] = state.players[1]!.id;
    state.botMinds[state.players[2]!.id] = { candidates: [{ word: 'secret candidate', confidence: 1 }], suspicion: {} };
    const snapshot = toLocalPublicDisplay(state, words);
    const forbidden = new Set(['secretWordId', 'moleIds', 'votes', 'botMinds', 'botClueMemory', 'moleFinalGuess', 'clueHistory', 'reconnectToken', 'guess']);
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) { expect(forbidden.has(key), key).toBe(false); visit(child); }
    };
    visit(snapshot);
    expect(validateLocalPublicDisplay(snapshot, state.sessionId)).toBe(true);
    expect(validateLocalPublicDisplay({ ...snapshot, secretWordId: state.secretWordId }, state.sessionId)).toBe(false);
    expect(snapshot.result).toBeNull();
    expect(snapshot.visibility).toBe('pass');
    expect(snapshot.voteCount).toBe(1);
  });

  it('keeps a locked Final Guess out of the public TV projection until reveal', () => {
    const started = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-bots'), seeded(93)), words, seeded(94));
    const mole = started.players[0]!;
    const privateGuess = { ...started, stage: 'guess' as const, moleIds: [mole.id], accusedIds: [mole.id], moleFinalGuess: { playerId: mole.id, guess: 'Apple' } };
    const snapshot = toLocalPublicDisplay(privateGuess, words);
    expect(snapshot.stage).toBe('guess');
    expect(snapshot.result).toBeNull();
    expect(JSON.stringify(snapshot)).not.toMatch(/Apple|moleFinalGuess|"guess":/i);
    expect(validateLocalPublicDisplay(snapshot, started.sessionId)).toBe(true);
  });
});

describe('local transition and scoring guards', () => {
  it('rejects malformed settings and duplicate or out-of-stage actions', () => {
    const players = roster();
    expect(() => createLocalGame(players, { ...localSettingsForPreset('local-classic'), boardSize: 11 as never }, seeded(100))).toThrow(/settings/i);
    const state = startLocalRound(createLocalGame(players, localSettingsForPreset('local-classic'), seeded(101)), words, seeded(102));
    expect(() => beginLocalVoting(state, words, seeded(103))).toThrow(/after the discussion/i);
    expect(() => finishLocalRound(state, words, undefined, seeded(104))).toThrow(/not ready to score/i);
  });

  it('requires a caught human Mole to make exactly one final board guess', () => {
    const started = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-classic'), seeded(105)), words, seeded(106));
    const human = started.players.find((player) => player.kind === 'human')!;
    const guessing = { ...started, stage: 'guess' as const, completedClueRounds: started.settings.requiredClueRoundsBeforeVoting, moleIds: [human.id], accusedIds: [human.id] };
    expect(() => finishLocalRound(guessing, words, undefined, seeded(107))).toThrow(/lock a Final Guess/i);
    const locked = lockLocalMoleGuess(guessing, words, ' definitely wrong ', seeded(108));
    expect(locked.moleFinalGuess?.guess).toBe('definitely wrong');
    expect(() => lockLocalMoleGuess(locked, words, 'second try', seeded(109))).toThrow(/already locked/i);
    const scored = finishLocalRound(locked, words);
    expect(['result', 'match-complete']).toContain(scored.stage);
    expect(scored.moleFinalGuess).toBeNull();
    expect(() => finishLocalRound(scored, words)).toThrow(/already been scored/i);
  });

  it.each([1, 2, 3, 4, 5] as const)('completes exactly %i Clue Rounds before discussion', (required) => {
    const random = seeded(400 + required);
    const settings = { ...localSettingsForPreset('local-classic'), requiredClueRoundsBeforeVoting: required };
    let state = startLocalRound(createLocalGame(roster(4, 2), settings, random), words, random);
    while (state.stage === 'roles') state = advanceLocalRole(state);
    const stableOrder = [...state.turnOrder];
    while (state.stage === 'clues') {
      const current = state.players.find((player) => player.id === state.turnOrder[state.currentTurn])!;
      state = playLocalClue(state, words, current.kind === 'human' ? `human ${state.currentClueRound} ${state.currentTurn}` : undefined, random);
      expect(state.turnOrder).toEqual(stableOrder);
    }
    expect(state.stage).toBe('discussion');
    expect(state.completedClueRounds).toBe(required);
    expect(Object.values(state.clueHistory).every((clues) => clues.length === required)).toBe(true);
  });

  it('rejects engine-level early voting even from a forged discussion state', () => {
    const started = startLocalRound(createLocalGame(roster(), localSettingsForPreset('local-classic'), seeded(510)), words, seeded(511));
    expect(() => beginLocalVoting({ ...started, stage: 'discussion', completedClueRounds: 1 }, words)).toThrow(/stays locked/i);
    expect(() => finishLocalRound({ ...started, stage: 'voting', accusedIds: [started.players[0]!.id] }, words)).toThrow(/cannot score/i);
  });

  it('routes a caught Bot Mole through Final Guess before scoring', () => {
    const started = startLocalRound(createLocalGame(roster(3, 1), localSettingsForPreset('local-classic'), seeded(520)), words, seeded(521));
    const bot = started.players.find((player) => player.kind === 'bot')!;
    const guessing = { ...started, stage: 'guess' as const, completedClueRounds: started.settings.requiredClueRoundsBeforeVoting, moleIds: [bot.id], accusedIds: [bot.id] };
    expect(() => finishLocalRound(guessing, words)).toThrow(/Final Guess/i);
    const locked = lockLocalMoleGuess(guessing, words, undefined, seeded(522));
    expect(locked.moleFinalGuess?.playerId).toBe(bot.id);
    expect(['result', 'match-complete']).toContain(finishLocalRound(locked, words).stage);
  });
});
