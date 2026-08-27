import type { BotPersonality, RoundResult } from '@moley/shared';
import { normalizeGuess } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';
import {
  assignMoles, botVote, fairTurnOrder, innocentBotClue, moleBotClueFromCandidates,
  randomPersonality, scoreRound, shuffled, updateMoleCandidates
} from './index';

export type LocalMode = 'pass-the-phone' | 'shared-screen' | 'party-board';
export type LocalPreset = 'local-classic' | 'local-bots' | 'pass-the-phone' | 'big-screen-party' | 'offline-cottage';
export type LocalStage = 'setup' | 'roles' | 'clues' | 'discussion' | 'voting' | 'guess' | 'result' | 'match-complete';
export type LocalDifficulty = 'easy' | 'normal' | 'sneaky';

export type LocalPlayer = {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  active: boolean;
  score: number;
  roundGain: number;
  moleRounds: number[];
  difficulty: LocalDifficulty;
  personality: BotPersonality;
  joinsNextRound?: boolean;
  leavesNextRound?: boolean;
};

export type LocalSettings = {
  preset: LocalPreset;
  mode: LocalMode;
  boardSize: 5 | 6 | 7 | 8 | 9 | 10;
  targetScore: number;
  clueSeconds: number;
  fastBots: boolean;
  sound: boolean;
  categories: string[];
  customWords: string[];
};

export type LocalGameState = {
  schemaVersion: 1;
  sessionId: string;
  stage: LocalStage;
  players: LocalPlayer[];
  settings: LocalSettings;
  roundNumber: number;
  boardIds: string[];
  secretWordId: string | null;
  moleIds: string[];
  turnOrder: string[];
  previousFirstIds: string[];
  roleIndex: number;
  currentTurn: number;
  clues: Record<string, string>;
  discussion: string[];
  votes: Record<string, string>;
  voteIndex: number;
  accusedIds: string[];
  botMinds: Record<string, { candidates: { word: string; confidence: number }[]; suspicion: Record<string, number> }>;
  botClueMemory: Record<string, string[]>;
  result: RoundResult | null;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
};

export const LOCAL_PRESETS: Record<LocalPreset, Pick<LocalSettings, 'mode' | 'boardSize' | 'targetScore' | 'clueSeconds' | 'fastBots'>> = {
  'local-classic': { mode: 'shared-screen', boardSize: 5, targetScore: 5, clueSeconds: 45, fastBots: false },
  'local-bots': { mode: 'shared-screen', boardSize: 6, targetScore: 5, clueSeconds: 30, fastBots: false },
  'pass-the-phone': { mode: 'pass-the-phone', boardSize: 5, targetScore: 5, clueSeconds: 45, fastBots: false },
  'big-screen-party': { mode: 'party-board', boardSize: 7, targetScore: 7, clueSeconds: 30, fastBots: true },
  'offline-cottage': { mode: 'pass-the-phone', boardSize: 5, targetScore: 5, clueSeconds: 0, fastBots: true }
};

export function localSettingsForPreset(preset: LocalPreset): LocalSettings {
  return { preset, ...LOCAL_PRESETS[preset], sound: true, categories: [], customWords: [] };
}

export function createLocalPlayer(name: string, kind: 'human' | 'bot', random: () => number = Math.random): LocalPlayer {
  return {
    id: `${kind}-${Math.floor(random() * 0x100000000).toString(36)}-${Date.now().toString(36)}`,
    name: name.trim(), kind, active: true, score: 0, roundGain: 0, moleRounds: [],
    difficulty: 'normal', personality: randomPersonality(random)
  };
}

export function createLocalGame(players: LocalPlayer[], settings: LocalSettings, random: () => number = Math.random): LocalGameState {
  const now = Date.now();
  return {
    schemaVersion: 1, sessionId: `local-${Math.floor(random() * 0x100000000).toString(36)}-${now.toString(36)}`,
    stage: 'setup', players, settings, roundNumber: 0, boardIds: [], secretWordId: null,
    moleIds: [], turnOrder: [], previousFirstIds: [], roleIndex: 0, currentTurn: 0,
    clues: {}, discussion: [], votes: {}, voteIndex: 0, accusedIds: [], botMinds: {},
    botClueMemory: {}, result: null, paused: false, createdAt: now, updatedAt: now
  };
}

export function buildLocalCatalog(catalog: WordEntry[], customWords: string[]): WordEntry[] {
  const custom = customWords.map((display, index) => ({
    id: `local-custom-${index}-${normalizeGuess(display).replaceAll(' ', '-')}`, display,
    category: 'Custom', difficulty: 'medium' as const, tags: ['custom'], safeBotClues: [],
    familySafe: true, botEnabled: false
  }));
  const deduped = new Map<string, WordEntry>();
  for (const word of [...catalog, ...custom]) {
    const key = normalizeGuess(word.display);
    const existing = deduped.get(key);
    if (!existing || (word.botEnabled && !existing.botEnabled)) deduped.set(key, word);
  }
  return [...deduped.values()];
}

export function startLocalRound(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  const roundPlayers = state.players.map((player) => player.leavesNextRound ? { ...player, active: false, leavesNextRound: false } : player.joinsNextRound ? { ...player, active: true, joinsNextRound: false } : player);
  const active = roundPlayers.filter((player) => player.active);
  if (active.length < 4) throw new Error('Local games need at least four active players or bots.');
  if (!active.some((player) => player.kind === 'human')) throw new Error('Keep at least one human in the local game.');
  const allWords = buildLocalCatalog(catalog, state.settings.customWords).filter((word) => !state.settings.categories.length || state.settings.categories.includes(word.category) || word.category === 'Custom');
  const candidates = allWords.length ? allWords : buildLocalCatalog(catalog, state.settings.customWords);
  const secretPool = active.some((player) => player.kind === 'bot') ? candidates.filter((word) => word.botEnabled) : candidates;
  if (!secretPool.length) throw new Error('This pack needs at least one bot-supported word for a game with bots.');
  const secret = secretPool[Math.floor(random() * secretPool.length)]!;
  const boardCount = state.settings.boardSize ** 2;
  const board = [secret, ...shuffled(candidates.filter((word) => word.id !== secret.id), random).slice(0, boardCount - 1)];
  if (board.length < boardCount) throw new Error(`This pack needs ${boardCount} unique words for a ${state.settings.boardSize}×${state.settings.boardSize} board.`);
  const roundNumber = state.roundNumber + 1;
  const moleIds = assignMoles(active, 1, roundNumber, random);
  const turnOrder = fairTurnOrder(active.map((player) => player.id), state.previousFirstIds, random);
  if (turnOrder.length > 1 && turnOrder.every((id, index) => id === state.turnOrder[index])) {
    [turnOrder[0], turnOrder[1]] = [turnOrder[1]!, turnOrder[0]!];
  }
  const humans = active.filter((player) => player.kind === 'human');
  return {
    ...state, stage: humans.length ? 'roles' : 'clues', roundNumber,
    players: roundPlayers.map((player) => ({ ...player, roundGain: 0, moleRounds: moleIds.includes(player.id) ? [...player.moleRounds, roundNumber] : player.moleRounds })),
    boardIds: shuffled(board, random).map((word) => word.id), secretWordId: secret.id, moleIds, turnOrder,
    previousFirstIds: [...state.previousFirstIds.slice(-2), turnOrder[0]!], roleIndex: 0, currentTurn: 0,
    clues: {}, discussion: [], votes: {}, voteIndex: 0, accusedIds: [], botMinds: {}, result: null,
    paused: false, updatedAt: Date.now()
  };
}

export function currentRolePlayer(state: LocalGameState): LocalPlayer | undefined {
  return state.players.filter((player) => player.active && player.kind === 'human')[state.roleIndex];
}

export function advanceLocalRole(state: LocalGameState): LocalGameState {
  const humans = state.players.filter((player) => player.active && player.kind === 'human');
  return state.roleIndex + 1 >= humans.length
    ? { ...state, stage: 'clues', roleIndex: 0, updatedAt: Date.now() }
    : { ...state, roleIndex: state.roleIndex + 1, updatedAt: Date.now() };
}

export function playLocalClue(state: LocalGameState, catalog: WordEntry[], humanClue?: string, random: () => number = Math.random): LocalGameState {
  const playerId = state.turnOrder[state.currentTurn];
  const player = state.players.find((candidate) => candidate.id === playerId);
  const secret = catalog.find((word) => word.id === state.secretWordId);
  if (!player || !secret) throw new Error('This round could not recover its current word or player.');
  let clue = humanClue?.trim() ?? '';
  let botMinds = state.botMinds;
  let botClueMemory = state.botClueMemory;
  if (player.kind === 'bot') {
    const used = [...Object.values(state.clues), ...(state.botClueMemory[secret.id] ?? [])];
    if (state.moleIds.includes(player.id)) {
      const board = state.boardIds.map((id) => catalog.find((word) => word.id === id)).filter(Boolean) as WordEntry[];
      let mind = state.botMinds[player.id] ?? { candidates: [], suspicion: {} };
      for (const observed of Object.values(state.clues)) mind = updateMoleCandidates(mind, observed, board);
      clue = moleBotClueFromCandidates(mind, Object.values(state.clues), board, used, player.difficulty, player.personality, random);
      botMinds = { ...state.botMinds, [player.id]: mind };
    } else {
      clue = innocentBotClue(secret, used, player.difficulty, random, player.personality);
      botClueMemory = { ...state.botClueMemory, [secret.id]: [...(state.botClueMemory[secret.id] ?? []).slice(-18), clue] };
    }
  }
  if (!clue) throw new Error('Enter a clue before continuing.');
  const clues = { ...state.clues, [player.id]: clue };
  const nextTurn = state.currentTurn + 1;
  if (nextTurn >= state.turnOrder.length) {
    return { ...state, clues, botMinds, botClueMemory, stage: 'discussion', currentTurn: state.currentTurn, discussion: localBotDiscussion(state.players, clues, secret, state.moleIds, random), updatedAt: Date.now() };
  }
  return { ...state, clues, botMinds, botClueMemory, currentTurn: nextTurn, updatedAt: Date.now() };
}

function localBotDiscussion(players: LocalPlayer[], clues: Record<string, string>, word: WordEntry, moleIds: string[], random: () => number): string[] {
  const lines: string[] = [];
  const used = new Set<string>();
  const templates = [
    (name: string) => `${name}'s clue felt pretty broad.`,
    (name: string) => `${name}'s answer connected for me.`,
    (name: string) => `I'm keeping an eye on ${name}.`,
    (name: string) => `${name} took an interesting angle.`
  ];
  for (const bot of players.filter((player) => player.active && player.kind === 'bot')) {
    const target = botVote(bot.id, players.filter((player) => player.active).map((player) => player.id), clues, moleIds.includes(bot.id) ? 'mole' : 'innocent', moleIds.includes(bot.id) ? null : word, bot.difficulty, random);
    const name = players.find((player) => player.id === target)?.name ?? 'that player';
    const choices = shuffled(templates, random).map((template) => template(name));
    const line = choices.find((candidate) => !used.has(normalizeGuess(candidate))) ?? `${bot.name} is still deciding.`;
    used.add(normalizeGuess(line));
    lines.push(`${bot.name}: ${line}`);
  }
  return lines;
}

export function beginLocalVoting(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  const secret = catalog.find((word) => word.id === state.secretWordId) ?? null;
  const active = state.players.filter((player) => player.active);
  const votes = { ...state.votes };
  for (const bot of active.filter((player) => player.kind === 'bot')) {
    votes[bot.id] = botVote(bot.id, active.map((player) => player.id), state.clues, state.moleIds.includes(bot.id) ? 'mole' : 'innocent', state.moleIds.includes(bot.id) ? null : secret, bot.difficulty, random);
  }
  return { ...state, stage: 'voting', votes, voteIndex: 0, updatedAt: Date.now() };
}

export function submitLocalVote(state: LocalGameState, voterId: string, targetId: string): LocalGameState {
  if (voterId === targetId) throw new Error('Players cannot vote for themselves.');
  const votes = { ...state.votes, [voterId]: targetId };
  const humans = state.players.filter((player) => player.active && player.kind === 'human');
  const nextIndex = state.voteIndex + 1;
  return { ...state, votes, voteIndex: Math.min(nextIndex, humans.length - 1), updatedAt: Date.now() };
}

export function allHumanVotesComplete(state: LocalGameState): boolean {
  return state.players.filter((player) => player.active && player.kind === 'human').every((player) => Boolean(state.votes[player.id]));
}

export function resolveLocalVoting(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  const active = state.players.filter((player) => player.active);
  const totals = new Map(active.map((player) => [player.id, 0]));
  for (const target of Object.values(state.votes)) if (totals.has(target)) totals.set(target, totals.get(target)! + 1);
  const top = Math.max(...totals.values());
  const tied = [...totals].filter(([, count]) => count === top).map(([id]) => id);
  const accusedIds = [shuffled(tied, random)[0]!];
  const caughtHumanMole = accusedIds.some((id) => state.moleIds.includes(id) && state.players.find((player) => player.id === id)?.kind === 'human');
  if (caughtHumanMole) return { ...state, accusedIds, stage: 'guess', updatedAt: Date.now() };
  return finishLocalRound({ ...state, accusedIds }, catalog, undefined, random);
}

export function finishLocalRound(state: LocalGameState, catalog: WordEntry[], humanGuessId?: string, random: () => number = Math.random): LocalGameState {
  const secret = catalog.find((word) => word.id === state.secretWordId);
  if (!secret) throw new Error('The saved secret word is unavailable.');
  const guesses: Record<string, { guess: string; correct?: boolean }> = {};
  for (const moleId of state.moleIds.filter((id) => state.accusedIds.includes(id))) {
    const mole = state.players.find((player) => player.id === moleId);
    if (mole?.kind === 'human') {
      const guessed = catalog.find((word) => word.id === humanGuessId)?.display ?? '';
      guesses[moleId] = { guess: guessed };
    } else if (mole) {
      const board = state.boardIds.map((id) => catalog.find((word) => word.id === id)).filter(Boolean) as WordEntry[];
      let mind = state.botMinds[moleId] ?? { candidates: [], suspicion: {} };
      for (const clue of Object.values(state.clues)) mind = updateMoleCandidates(mind, clue, board);
      const best = mind.candidates[0]?.word ?? board[Math.floor(random() * board.length)]?.display ?? '';
      const accuracy = mole.difficulty === 'easy' ? 0.35 : mole.difficulty === 'sneaky' ? 0.78 : 0.58;
      guesses[moleId] = { guess: best, correct: normalizeGuess(best) === normalizeGuess(secret.display) && random() < accuracy };
    }
  }
  const result = scoreRound({ playerIds: state.players.filter((player) => player.active).map((player) => player.id), moleIds: state.moleIds, accusedIds: state.accusedIds, guesses, word: secret });
  const players = state.players.map((player) => ({ ...player, roundGain: result.gains[player.id] ?? 0, score: player.score + (result.gains[player.id] ?? 0) }));
  const complete = players.some((player) => player.score >= state.settings.targetScore);
  return { ...state, players, result, stage: complete ? 'match-complete' : 'result', updatedAt: Date.now() };
}

export function resetLocalMatch(state: LocalGameState, keepScores = false): LocalGameState {
  return {
    ...state, stage: 'setup', roundNumber: keepScores ? state.roundNumber : 0,
    players: state.players.map((player) => ({ ...player, score: keepScores ? player.score : 0, roundGain: 0, moleRounds: keepScores ? player.moleRounds : [] })),
    boardIds: [], secretWordId: null, moleIds: [], turnOrder: [], previousFirstIds: keepScores ? state.previousFirstIds : [],
    clues: {}, discussion: [], votes: {}, accusedIds: [], result: null, updatedAt: Date.now()
  };
}

export function validateLocalState(value: unknown, catalog: WordEntry[]): value is LocalGameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LocalGameState>;
  if (state.schemaVersion !== 1 || !state.sessionId || !Array.isArray(state.players) || !state.settings) return false;
  if (state.secretWordId && !catalog.some((word) => word.id === state.secretWordId) && !state.secretWordId.startsWith('local-custom-')) return false;
  return true;
}
