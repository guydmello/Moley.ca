import type { BotPersonality, RoundResult } from '@moley/shared';
import { normalizeGuess, normalizeName, safeDisplayName } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';
import {
  assignMoles, botDiscussionLine, botVote, buildWordBoard, customWordEntries, dedupeWords, innocentBotClue,
  moleBotClueFromCandidates, moleBotGuess, newRoundTurnOrder, normalizeWordKey,
  randomPersonality, scoreRound, shuffled, updateMoleCandidates, validateBotClue
} from './index';

export type LocalMode = 'pass-the-phone' | 'shared-screen' | 'party-board';
export type LocalPreset = 'local-classic' | 'local-bots' | 'pass-the-phone' | 'big-screen-party' | 'offline-cottage';
export type LocalStage = 'setup' | 'roles' | 'clues' | 'discussion' | 'voting' | 'guess' | 'result' | 'match-complete';
export type LocalVisibility = 'private' | 'pass' | 'public';
export type LocalDifficulty = 'easy' | 'normal' | 'sneaky';
export const LOCAL_SCHEMA_VERSION = 2 as const;

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
  haptics: boolean;
  categories: string[];
  customWords: string[];
};

export type LocalGameState = {
  schemaVersion: typeof LOCAL_SCHEMA_VERSION;
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

export type LocalPublicDisplayState = {
  schemaVersion: 1;
  sessionId: string;
  visibility: Exclude<LocalVisibility, 'private'>;
  stage: LocalStage;
  roundNumber: number;
  board: { id: string; display: string }[];
  boardSize: LocalSettings['boardSize'];
  targetScore: number;
  players: Pick<LocalPlayer, 'id' | 'name' | 'kind' | 'score' | 'roundGain'>[];
  turnOrder: string[];
  currentTurn: number;
  clues: Record<string, string>;
  discussion: string[];
  voteCount: number;
  accusedIds: string[];
  result: RoundResult | null;
  paused: boolean;
  updatedAt: number;
};

export function localStageVisibility(stage: LocalStage): Exclude<LocalVisibility, 'private'> {
  return ['roles', 'voting', 'guess'].includes(stage) ? 'pass' : 'public';
}

export function toLocalPublicDisplay(state: LocalGameState, catalog: WordEntry[]): LocalPublicDisplayState {
  const reveal = ['result', 'match-complete'].includes(state.stage);
  const active = state.players.filter((player) => player.active);
  return {
    schemaVersion: 1,
    sessionId: state.sessionId,
    visibility: localStageVisibility(state.stage),
    stage: state.stage,
    roundNumber: state.roundNumber,
    board: state.boardIds.flatMap((id) => {
      const word = catalog.find((entry) => entry.id === id);
      return word ? [{ id: word.id, display: word.display }] : [];
    }),
    boardSize: state.settings.boardSize,
    targetScore: state.settings.targetScore,
    players: active.map(({ id, name, kind, score, roundGain }) => ({ id, name, kind, score, roundGain })),
    turnOrder: state.turnOrder,
    currentTurn: state.currentTurn,
    clues: { ...state.clues },
    discussion: [...state.discussion],
    voteCount: Object.keys(state.votes).length,
    accusedIds: ['guess', 'result', 'match-complete'].includes(state.stage) ? [...state.accusedIds] : [],
    result: reveal ? state.result : null,
    paused: state.paused,
    updatedAt: state.updatedAt
  };
}

export function validateLocalPublicDisplay(value: unknown, sessionId: string): value is LocalPublicDisplayState {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.sessionId !== sessionId || !LOCAL_STAGES.includes(value.stage as LocalStage)) return false;
  const allowed = new Set(['schemaVersion', 'sessionId', 'visibility', 'stage', 'roundNumber', 'board', 'boardSize', 'targetScore', 'players', 'turnOrder', 'currentTurn', 'clues', 'discussion', 'voteCount', 'accusedIds', 'result', 'paused', 'updatedAt']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  const stage = value.stage as LocalStage;
  if (value.visibility !== localStageVisibility(stage) || !integerIn(value.roundNumber, 0, 100_000) || ![5, 6, 7, 8, 9, 10].includes(Number(value.boardSize))) return false;
  if (!integerIn(value.targetScore, 1, 100) || !integerIn(value.currentTurn, 0, 100) || !integerIn(value.voteCount, 0, 100) || typeof value.paused !== 'boolean' || !finiteTimestamp(value.updatedAt)) return false;
  if (!Array.isArray(value.players) || value.players.length > 100 || !value.players.every(validPublicPlayer)) return false;
  const playerIds = new Set(value.players.map((player) => (player as { id: string }).id));
  if (playerIds.size !== value.players.length || !Array.isArray(value.board) || value.board.length > 100 || !value.board.every(validPublicBoardWord)) return false;
  const board = value.board as { id: string; display: string }[];
  if (new Set(board.map((word) => word.id)).size !== board.length || new Set(board.map((word) => normalizeWordKey(word.display))).size !== board.length) return false;
  if (!boundedStringArray(value.turnOrder, 100, 160) || value.turnOrder.some((id) => !playerIds.has(id)) || new Set(value.turnOrder).size !== value.turnOrder.length) return false;
  if (!validStringRecord(value.clues, 100, 80) || Object.keys(value.clues).some((id) => !playerIds.has(id)) || !boundedStringArray(value.discussion, 100, 280)) return false;
  if (!boundedStringArray(value.accusedIds, 20, 160) || value.accusedIds.some((id) => !playerIds.has(id))) return false;
  if (!(value.result === null || validRoundResult(value.result))) return false;
  if (!['result', 'match-complete'].includes(stage) && value.result !== null) return false;
  if (!['guess', 'result', 'match-complete'].includes(stage) && value.accusedIds.length) return false;
  return true;
}

export const LOCAL_PRESETS: Record<LocalPreset, Pick<LocalSettings, 'mode' | 'boardSize' | 'targetScore' | 'clueSeconds' | 'fastBots'>> = {
  'local-classic': { mode: 'shared-screen', boardSize: 5, targetScore: 5, clueSeconds: 45, fastBots: false },
  'local-bots': { mode: 'shared-screen', boardSize: 6, targetScore: 5, clueSeconds: 30, fastBots: false },
  'pass-the-phone': { mode: 'pass-the-phone', boardSize: 5, targetScore: 5, clueSeconds: 45, fastBots: false },
  'big-screen-party': { mode: 'party-board', boardSize: 7, targetScore: 7, clueSeconds: 30, fastBots: true },
  'offline-cottage': { mode: 'pass-the-phone', boardSize: 5, targetScore: 5, clueSeconds: 0, fastBots: true }
};

export function localSettingsForPreset(preset: LocalPreset): LocalSettings {
  return { preset, ...LOCAL_PRESETS[preset], sound: true, haptics: true, categories: [], customWords: [] };
}

export function validateLocalSettings(value: unknown): value is LocalSettings {
  if (!isRecord(value)) return false;
  return LOCAL_PRESET_IDS.includes(value.preset as LocalPreset) && LOCAL_MODES.includes(value.mode as LocalMode) &&
    [5, 6, 7, 8, 9, 10].includes(Number(value.boardSize)) && integerIn(value.targetScore, 1, 100) && integerIn(value.clueSeconds, 0, 300) &&
    [value.fastBots, value.sound, value.haptics].every((entry) => typeof entry === 'boolean') &&
    boundedStringArray(value.categories, 80, 48) && boundedStringArray(value.customWords, 1_000, 80);
}

export function createLocalPlayer(name: string, kind: 'human' | 'bot', random: () => number = Math.random): LocalPlayer {
  const safeName = safeDisplayName(name);
  if (!safeName) throw new Error('Every local player needs a display name.');
  return {
    id: `${kind}-${Math.floor(random() * 0x100000000).toString(36)}-${Date.now().toString(36)}`,
    name: safeName, kind, active: true, score: 0, roundGain: 0, moleRounds: [],
    difficulty: 'normal', personality: randomPersonality(random)
  };
}

export function validateLocalRoster(players: LocalPlayer[]): string[] {
  const errors: string[] = [];
  if (players.length > 100) errors.push('Local games support at most 100 seats.');
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const player of players) {
    if (!player.id || ids.has(player.id)) errors.push('Every local seat needs a unique identity.');
    ids.add(player.id);
    const name = safeDisplayName(player.name);
    const normalized = normalizeName(name);
    if (!name) errors.push('Every local player needs a display name.');
    else if (names.has(normalized)) errors.push(`The name “${name}” is already in this local game.`);
    names.add(normalized);
  }
  return [...new Set(errors)];
}

export function createLocalGame(players: LocalPlayer[], settings: LocalSettings, random: () => number = Math.random): LocalGameState {
  const rosterErrors = validateLocalRoster(players);
  if (rosterErrors.length) throw new Error(rosterErrors[0]);
  if (!validateLocalSettings(settings)) throw new Error('One of those local game settings needs another look.');
  const now = Date.now();
  return {
    schemaVersion: LOCAL_SCHEMA_VERSION, sessionId: `local-${Math.floor(random() * 0x100000000).toString(36)}-${now.toString(36)}`,
    stage: 'setup', players, settings, roundNumber: 0, boardIds: [], secretWordId: null,
    moleIds: [], turnOrder: [], previousFirstIds: [], roleIndex: 0, currentTurn: 0,
    clues: {}, discussion: [], votes: {}, voteIndex: 0, accusedIds: [], botMinds: {},
    botClueMemory: {}, result: null, paused: false, createdAt: now, updatedAt: now
  };
}

export function buildLocalCatalog(catalog: WordEntry[], customWords: string[]): WordEntry[] {
  return dedupeWords([...catalog, ...customWordEntries(customWords, 'local-custom')]);
}

export function startLocalRound(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  const roundPlayers = state.players.map((player) => player.leavesNextRound ? { ...player, active: false, leavesNextRound: false } : player.joinsNextRound ? { ...player, active: true, joinsNextRound: false } : player);
  const active = roundPlayers.filter((player) => player.active);
  if (active.length < 4) throw new Error('Local games need at least four active players or bots.');
  if (!active.some((player) => player.kind === 'human')) throw new Error('Keep at least one human in the local game.');
  const allWords = buildLocalCatalog(catalog, state.settings.customWords).filter((word) => !state.settings.categories.length || state.settings.categories.includes(word.category) || word.category === 'Custom Pack');
  const candidates = allWords.length ? allWords : buildLocalCatalog(catalog, state.settings.customWords);
  const supportedFallback = buildLocalCatalog(catalog, []).filter((word) => word.botEnabled);
  const filteredBotSecrets = candidates.filter((word) => word.botEnabled);
  const secretPool = active.some((player) => player.kind === 'bot') ? (filteredBotSecrets.length ? filteredBotSecrets : supportedFallback) : candidates;
  if (!secretPool.length) throw new Error('This pack needs at least one bot-supported word for a game with bots.');
  const secret = secretPool[Math.floor(random() * secretPool.length)]!;
  const board = buildWordBoard(candidates, state.settings.boardSize, secret, random);
  const roundNumber = state.roundNumber + 1;
  const moleIds = assignMoles(active, 1, roundNumber, random);
  const turnOrder = newRoundTurnOrder(active.map((player) => player.id), state.turnOrder, state.previousFirstIds, random);
  const humans = active.filter((player) => player.kind === 'human');
  return {
    ...state, stage: humans.length ? 'roles' : 'clues', roundNumber,
    players: roundPlayers.map((player) => ({ ...player, roundGain: 0, moleRounds: moleIds.includes(player.id) ? [...player.moleRounds, roundNumber] : player.moleRounds })),
    boardIds: board.map((word) => word.id), secretWordId: secret.id, moleIds, turnOrder,
    previousFirstIds: [...state.previousFirstIds.slice(-2), turnOrder[0]!], roleIndex: 0, currentTurn: 0,
    clues: {}, discussion: [], votes: {}, voteIndex: 0, accusedIds: [], botMinds: {}, result: null,
    paused: false, updatedAt: Date.now()
  };
}

export function currentRolePlayer(state: LocalGameState): LocalPlayer | undefined {
  return state.players.filter((player) => player.active && player.kind === 'human')[state.roleIndex];
}

export function advanceLocalRole(state: LocalGameState): LocalGameState {
  if (state.stage !== 'roles') throw new Error('Private roles are not being checked right now.');
  const humans = state.players.filter((player) => player.active && player.kind === 'human');
  return state.roleIndex + 1 >= humans.length
    ? { ...state, stage: 'clues', roleIndex: 0, updatedAt: Date.now() }
    : { ...state, roleIndex: state.roleIndex + 1, updatedAt: Date.now() };
}

export function playLocalClue(state: LocalGameState, catalog: WordEntry[], humanClue?: string, random: () => number = Math.random): LocalGameState {
  if (state.stage !== 'clues') throw new Error('Clues are not being collected right now.');
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
  if (clue.length > 80) throw new Error('Keep clues under 80 characters.');
  if (player.kind === 'human' && !state.moleIds.includes(player.id) && !validateBotClue(clue, secret, 80)) throw new Error('That clue is too close to the secret word.');
  const clues = { ...state.clues, [player.id]: clue };
  const nextTurn = state.currentTurn + 1;
  if (nextTurn >= state.turnOrder.length) {
    return { ...state, clues, botMinds, botClueMemory, stage: 'discussion', currentTurn: state.currentTurn, discussion: localBotDiscussion(state.players, clues, secret, state.moleIds, random), updatedAt: Date.now() };
  }
  return { ...state, clues, botMinds, botClueMemory, currentTurn: nextTurn, updatedAt: Date.now() };
}

function localBotDiscussion(players: LocalPlayer[], clues: Record<string, string>, word: WordEntry, moleIds: string[], random: () => number): string[] {
  const lines: string[] = [];
  for (const bot of players.filter((player) => player.active && player.kind === 'bot')) {
    const target = botVote(bot.id, players.filter((player) => player.active).map((player) => player.id), clues, moleIds.includes(bot.id) ? 'mole' : 'innocent', moleIds.includes(bot.id) ? null : word, bot.difficulty, random);
    const name = players.find((player) => player.id === target)?.name ?? 'that player';
    const targetClue = clues[target] ?? '';
    const related = [...word.tags, ...word.safeBotClues].some((term) => normalizeGuess(targetClue).includes(normalizeGuess(term)));
    lines.push(botDiscussionLine(bot.name, name, targetClue, related, bot.personality, lines, random));
  }
  return lines;
}

export function beginLocalVoting(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  if (state.stage !== 'discussion') throw new Error('Voting can only begin after the discussion.');
  const secret = catalog.find((word) => word.id === state.secretWordId) ?? null;
  const active = state.players.filter((player) => player.active);
  const votes = { ...state.votes };
  for (const bot of active.filter((player) => player.kind === 'bot')) {
    votes[bot.id] = botVote(bot.id, active.map((player) => player.id), state.clues, state.moleIds.includes(bot.id) ? 'mole' : 'innocent', state.moleIds.includes(bot.id) ? null : secret, bot.difficulty, random);
  }
  return { ...state, stage: 'voting', votes, voteIndex: 0, updatedAt: Date.now() };
}

export function submitLocalVote(state: LocalGameState, voterId: string, targetId: string): LocalGameState {
  if (state.stage !== 'voting') throw new Error('Voting is not open right now.');
  const voter = state.players.find((player) => player.id === voterId && player.active);
  const target = state.players.find((player) => player.id === targetId && player.active);
  if (!voter || voter.kind !== 'human' || !target) throw new Error('That local vote is not eligible.');
  if (voterId === targetId) throw new Error('Players cannot vote for themselves.');
  if (state.votes[voterId]) throw new Error('That local vote is already locked.');
  const votes = { ...state.votes, [voterId]: targetId };
  const humans = state.players.filter((player) => player.active && player.kind === 'human');
  const nextIndex = state.voteIndex + 1;
  return { ...state, votes, voteIndex: Math.min(nextIndex, humans.length - 1), updatedAt: Date.now() };
}

export function allHumanVotesComplete(state: LocalGameState): boolean {
  return state.players.filter((player) => player.active && player.kind === 'human').every((player) => Boolean(state.votes[player.id]));
}

export function resolveLocalVoting(state: LocalGameState, catalog: WordEntry[], random: () => number = Math.random): LocalGameState {
  if (state.stage !== 'voting' || !allHumanVotesComplete(state)) throw new Error('Finish every private vote before the reveal.');
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
  if (!['voting', 'guess'].includes(state.stage)) throw new Error('This local round has already been scored or is not ready to score.');
  const secret = catalog.find((word) => word.id === state.secretWordId);
  if (!secret) throw new Error('The saved secret word is unavailable.');
  const guesses: Record<string, { guess: string; correct?: boolean }> = {};
  for (const moleId of state.moleIds.filter((id) => state.accusedIds.includes(id))) {
    const mole = state.players.find((player) => player.id === moleId);
    if (mole?.kind === 'human') {
      if (!humanGuessId || !state.boardIds.includes(humanGuessId)) throw new Error('The caught Mole must choose one final board word.');
      const guessed = catalog.find((word) => word.id === humanGuessId)?.display ?? '';
      if (!guessed) throw new Error('That final word guess is unavailable.');
      guesses[moleId] = { guess: guessed };
    } else if (mole) {
      const board = state.boardIds.map((id) => catalog.find((word) => word.id === id)).filter(Boolean) as WordEntry[];
      let mind = state.botMinds[moleId] ?? { candidates: [], suspicion: {} };
      for (const clue of Object.values(state.clues)) mind = updateMoleCandidates(mind, clue, board);
      guesses[moleId] = { guess: moleBotGuess(mind, board, mole.difficulty, random) };
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
  if (!isRecord(value)) return false;
  const state = value as Partial<LocalGameState>;
  if (state.schemaVersion !== LOCAL_SCHEMA_VERSION || !boundedString(state.sessionId, 120) || !Array.isArray(state.players) || !isRecord(state.settings)) return false;
  const settings = state.settings as Partial<LocalSettings>;
  if (!validateLocalSettings(settings)) return false;
  const boardSize = settings.boardSize as LocalSettings['boardSize'];
  if (![settings.fastBots, settings.sound, settings.haptics].every((entry) => typeof entry === 'boolean')) return false;
  if (!boundedStringArray(settings.categories, 80, 48) || !boundedStringArray(settings.customWords, 1_000, 80)) return false;
  if (!LOCAL_STAGES.includes(state.stage as LocalStage) || !integerIn(state.roundNumber, 0, 100_000)) return false;
  if (!integerIn(state.roleIndex, 0, 100) || !integerIn(state.currentTurn, 0, 100) || !integerIn(state.voteIndex, 0, 100)) return false;
  if (!finiteTimestamp(state.createdAt) || !finiteTimestamp(state.updatedAt) || state.updatedAt! < state.createdAt!) return false;

  if (state.players.length > 100 || !state.players.every(validLocalPlayer)) return false;
  if (validateLocalRoster(state.players).length) return false;
  const playerIds = new Set(state.players.map((player) => player.id));
  const activeIds = new Set(state.players.filter((player) => player.active).map((player) => player.id));
  if (!boundedStringArray(state.boardIds, 100, 160) || new Set(state.boardIds).size !== state.boardIds.length) return false;
  if (!boundedStringArray(state.turnOrder, 100, 160) || new Set(state.turnOrder).size !== state.turnOrder.length || state.turnOrder.some((id) => !activeIds.has(id))) return false;
  if (!boundedStringArray(state.previousFirstIds, 3, 160) || state.previousFirstIds.some((id) => !playerIds.has(id))) return false;
  if (!boundedStringArray(state.moleIds, 20, 160) || new Set(state.moleIds).size !== state.moleIds.length || state.moleIds.some((id) => !activeIds.has(id))) return false;
  if (!boundedStringArray(state.accusedIds, 20, 160) || new Set(state.accusedIds).size !== state.accusedIds.length || state.accusedIds.some((id) => !activeIds.has(id))) return false;
  if (!boundedStringArray(state.discussion, 100, 280)) return false;
  if (!validStringRecord(state.clues, 100, 80) || !validStringRecord(state.votes, 100, 160)) return false;
  if (Object.keys(state.clues).some((id) => !activeIds.has(id))) return false;
  if (Object.entries(state.votes).some(([voter, target]) => !activeIds.has(voter) || !activeIds.has(target) || voter === target)) return false;
  if (!validBotMinds(state.botMinds, playerIds) || !validBotClueMemory(state.botClueMemory)) return false;
  if (typeof state.paused !== 'boolean' || !(state.result === null || validRoundResult(state.result))) return false;

  const knownCatalog = buildLocalCatalog(catalog, settings.customWords);
  const byId = new Map(knownCatalog.map((word) => [word.id, word]));
  if (state.secretWordId !== null && (!boundedString(state.secretWordId, 160) || !byId.has(state.secretWordId))) return false;
  const boardWords = state.boardIds.map((id) => byId.get(id));
  if (boardWords.some((word) => !word) || new Set(boardWords.map((word) => normalizeWordKey(word!.display))).size !== boardWords.length) return false;
  if (state.stage === 'setup') {
    if (state.boardIds.length || state.secretWordId !== null || state.turnOrder.length || state.moleIds.length) return false;
  } else {
    if (state.boardIds.length !== boardSize ** 2 || !state.secretWordId || !state.boardIds.includes(state.secretWordId)) return false;
    if (state.turnOrder.length !== activeIds.size || state.turnOrder.some((id) => !activeIds.has(id))) return false;
    if (!state.moleIds.length || state.currentTurn! >= state.turnOrder.length) return false;
  }
  if (state.stage === 'result' && state.result === null) return false;
  return true;
}

/** Upgrades durable offline saves without ever guessing at missing private state. */
export function migrateLocalState(value: unknown, catalog: WordEntry[]): LocalGameState | null {
  if (!isRecord(value) || ![1, LOCAL_SCHEMA_VERSION].includes(Number(value.schemaVersion))) return null;
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const preset = LOCAL_PRESET_IDS.includes(rawSettings.preset as LocalPreset) ? rawSettings.preset as LocalPreset : 'local-classic';
  const defaults = localSettingsForPreset(preset);
  const players = Array.isArray(value.players) ? value.players.map((entry) => {
    if (!isRecord(entry)) return entry;
    return {
      ...entry,
      name: typeof entry.name === 'string' ? safeDisplayName(entry.name) : entry.name,
      active: typeof entry.active === 'boolean' ? entry.active : true,
      score: entry.score ?? 0,
      roundGain: entry.roundGain ?? 0,
      moleRounds: entry.moleRounds ?? [],
      difficulty: entry.difficulty ?? 'normal',
      personality: entry.personality ?? 'cautious'
    };
  }) : value.players;
  const candidate: unknown = {
    ...value,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    players,
    settings: {
      ...defaults,
      ...rawSettings,
      preset,
      haptics: typeof rawSettings.haptics === 'boolean' ? rawSettings.haptics : true
    },
    previousFirstIds: value.previousFirstIds ?? [],
    discussion: value.discussion ?? [],
    accusedIds: value.accusedIds ?? [],
    botMinds: value.botMinds ?? {},
    botClueMemory: value.botClueMemory ?? {},
    paused: typeof value.paused === 'boolean' ? value.paused : false
  };
  return validateLocalState(candidate, catalog) ? candidate : null;
}

const LOCAL_PRESET_IDS: LocalPreset[] = ['local-classic', 'local-bots', 'pass-the-phone', 'big-screen-party', 'offline-cottage'];
const LOCAL_MODES: LocalMode[] = ['pass-the-phone', 'shared-screen', 'party-board'];
const LOCAL_STAGES: LocalStage[] = ['setup', 'roles', 'clues', 'discussion', 'voting', 'guess', 'result', 'match-complete'];
const LOCAL_DIFFICULTIES: LocalDifficulty[] = ['easy', 'normal', 'sneaky'];
const LOCAL_PERSONALITIES: BotPersonality[] = ['confident', 'cautious', 'chaotic', 'detective', 'quiet', 'bluffing', 'literal', 'creative'];

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function boundedString(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function integerIn(value: unknown, min: number, max: number): value is number { return Number.isInteger(value) && Number(value) >= min && Number(value) <= max; }
function finiteTimestamp(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function boundedStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((entry) => boundedString(entry, maxLength));
}
function validStringRecord(value: unknown, maxItems: number, maxLength: number): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= maxItems && entries.every(([key, entry]) => !['__proto__', 'constructor', 'prototype'].includes(key) && boundedString(key, 160) && boundedString(entry, maxLength));
}
function validNumberRecord(value: unknown, maxItems: number): value is Record<string, number> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= maxItems && entries.every(([key, entry]) => boundedString(key, 160) && typeof entry === 'number' && Number.isFinite(entry));
}
function validLocalPlayer(value: unknown): value is LocalPlayer {
  if (!isRecord(value) || !boundedString(value.id, 160) || !boundedString(value.name, 24) || safeDisplayName(value.name) !== value.name) return false;
  if (!['human', 'bot'].includes(String(value.kind)) || typeof value.active !== 'boolean' || !integerIn(value.score, 0, 1_000_000) || !integerIn(value.roundGain, 0, 1_000)) return false;
  if (!Array.isArray(value.moleRounds) || value.moleRounds.length > 100_000 || !value.moleRounds.every((round) => integerIn(round, 1, 100_000))) return false;
  if (!LOCAL_DIFFICULTIES.includes(value.difficulty as LocalDifficulty) || !LOCAL_PERSONALITIES.includes(value.personality as BotPersonality)) return false;
  return (value.joinsNextRound === undefined || typeof value.joinsNextRound === 'boolean') && (value.leavesNextRound === undefined || typeof value.leavesNextRound === 'boolean');
}
function validPublicPlayer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const allowed = new Set(['id', 'name', 'kind', 'score', 'roundGain']);
  return Object.keys(value).every((key) => allowed.has(key)) && boundedString(value.id, 160) && boundedString(value.name, 24) && safeDisplayName(value.name) === value.name &&
    ['human', 'bot'].includes(String(value.kind)) && integerIn(value.score, 0, 1_000_000) && integerIn(value.roundGain, 0, 1_000);
}
function validPublicBoardWord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).every((key) => ['id', 'display'].includes(key)) && boundedString(value.id, 160) && boundedString(value.display, 80);
}
function validBotMinds(value: unknown, playerIds: Set<string>): boolean {
  if (!isRecord(value) || Object.keys(value).length > 100) return false;
  return Object.entries(value).every(([playerId, mind]) => {
    if (!playerIds.has(playerId) || !isRecord(mind) || !Array.isArray(mind.candidates) || mind.candidates.length > 100 || !isRecord(mind.suspicion)) return false;
    if (!mind.candidates.every((candidate) => isRecord(candidate) && boundedString(candidate.word, 80) && typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence))) return false;
    return validNumberRecord(mind.suspicion, 100);
  });
}
function validBotClueMemory(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length > 500) return false;
  return Object.entries(value).every(([wordId, clues]) => boundedString(wordId, 160) && boundedStringArray(clues, 50, 80));
}
function validRoundResult(value: unknown): value is RoundResult {
  if (!isRecord(value)) return false;
  return boundedStringArray(value.accusedIds, 20, 160) && boundedStringArray(value.moleIds, 20, 160) && boundedStringArray(value.caughtMoleIds, 20, 160) &&
    boundedStringArray(value.escapedMoleIds, 20, 160) && boundedStringArray(value.correctGuessMoleIds, 20, 160) && boundedString(value.secretWord, 80) &&
    validNumberRecord(value.gains, 100) && boundedString(value.headline, 280);
}
