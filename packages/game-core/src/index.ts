import type { BotPersonality, GameSettings, GameStage, RoundResult } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';
import { normalizeGuess } from '@moley/shared';

export const LEGAL_TRANSITIONS: Record<GameStage, GameStage[]> = {
  ROOM_LOBBY: ['ROUND_SETUP'],
  ROUND_SETUP: ['ROLE_REVEAL', 'ROOM_LOBBY'],
  ROLE_REVEAL: ['ROLE_READY', 'CLUE_PREPARATION'],
  ROLE_READY: ['CLUE_PREPARATION'],
  CLUE_PREPARATION: ['CLUE_TURN'],
  CLUE_TURN: ['CLUE_TURN', 'DISCUSSION'],
  DISCUSSION: ['VOTING'],
  VOTING: ['VOTE_REVEAL'],
  VOTE_REVEAL: ['TIE_RESOLUTION', 'ACCUSATION'],
  TIE_RESOLUTION: ['ACCUSATION'],
  ACCUSATION: ['MOLE_GUESS', 'ROUND_REVEAL'],
  MOLE_GUESS: ['MOLE_GUESS', 'ROUND_REVEAL'],
  ROUND_REVEAL: ['ROUND_SCORING'],
  ROUND_SCORING: ['SCOREBOARD', 'MATCH_COMPLETE'],
  SCOREBOARD: ['ROUND_SETUP', 'MATCH_COMPLETE'],
  MATCH_COMPLETE: ['ROOM_LOBBY']
};

export function canTransition(from: GameStage, to: GameStage): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function autoMoleCount(seats: number): number {
  if (seats <= 7) return 1;
  if (seats <= 13) return 2;
  if (seats <= 20) return 3;
  return Math.max(1, Math.min(Math.floor((seats - 1) / 2), Math.round(seats / 6.5)));
}

export function moleBalanceWarning(seats: number, count: number): string | null {
  if (count >= Math.ceil(seats / 2)) return 'Moles need an innocent majority. Choose fewer Moles.';
  if (count > autoMoleCount(seats) + 1) return 'That is a very mole-heavy room. Expect a difficult round for innocents.';
  return null;
}

export type AssignmentCandidate = { id: string; moleRounds: number[]; kind: 'human' | 'bot' };

export function assignMoles(
  players: AssignmentCandidate[],
  count: number,
  roundNumber: number,
  random: () => number = Math.random
): string[] {
  const pool = [...players];
  const picked: string[] = [];
  const safeCount = Math.max(1, Math.min(count, Math.floor((players.length - 1) / 2)));
  while (picked.length < safeCount && pool.length) {
    const weighted = pool.map((player) => {
      const last = player.moleRounds.at(-1);
      const gap = last === undefined ? roundNumber + 2 : Math.max(0, roundNumber - last);
      const recentPenalty = last === roundNumber - 1 ? 0.25 : 1;
      const humanBalance = player.kind === 'human' ? 1.05 : 1;
      return { player, weight: (1 + Math.min(gap, 5) * 0.3) * recentPenalty * humanBalance };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    let choice = weighted.at(-1)!;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) { choice = item; break; }
    }
    picked.push(choice.player.id);
    pool.splice(pool.findIndex((item) => item.id === choice.player.id), 1);
  }
  return picked;
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

export type RankedVote = { playerId: string; votes: number };
export type VoteResolution = { accusedIds: string[]; tiedIds: string[]; ranked: RankedVote[] };

export function rankVotes(eligibleIds: string[], votes: Record<string, string>, accusationCount: number): VoteResolution {
  const totals = new Map(eligibleIds.map((id) => [id, 0]));
  for (const target of Object.values(votes)) if (totals.has(target)) totals.set(target, totals.get(target)! + 1);
  const ranked = [...totals].map(([playerId, count]) => ({ playerId, votes: count })).sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));
  const cutoffIndex = Math.min(accusationCount, ranked.length) - 1;
  const cutoff = ranked[cutoffIndex]?.votes ?? 0;
  const guaranteed = ranked.filter((item) => item.votes > cutoff).map((item) => item.playerId);
  const tiedIds = ranked.filter((item) => item.votes === cutoff).map((item) => item.playerId);
  const needed = Math.max(0, accusationCount - guaranteed.length);
  return {
    accusedIds: tiedIds.length === needed ? [...guaranteed, ...tiedIds] : guaranteed,
    tiedIds: tiedIds.length > needed ? tiedIds : [],
    ranked
  };
}

export function resolveTie(tiedIds: string[], needed: number, random: () => number = Math.random): string[] {
  return shuffled(tiedIds, random).slice(0, needed);
}

export type ScoreInput = {
  playerIds: string[];
  moleIds: string[];
  accusedIds: string[];
  guesses: Record<string, { guess: string; correct?: boolean }>;
  word: WordEntry;
};

export function scoreRound(input: ScoreInput): RoundResult {
  const caughtMoleIds = input.moleIds.filter((id) => input.accusedIds.includes(id));
  const escapedMoleIds = input.moleIds.filter((id) => !input.accusedIds.includes(id));
  const accepted = [input.word.display, ...(input.word.aliases ?? [])].map(normalizeGuess);
  const correctGuessMoleIds = caughtMoleIds.filter((id) => {
    const value = input.guesses[id];
    return value?.correct ?? (value ? accepted.includes(normalizeGuess(value.guess)) : false);
  });
  const gains = Object.fromEntries(input.playerIds.map((id) => [id, 0]));
  for (const id of escapedMoleIds) gains[id] = 2;
  for (const id of correctGuessMoleIds) gains[id] = 1;
  if (caughtMoleIds.length === input.moleIds.length && correctGuessMoleIds.length === 0) {
    for (const id of input.playerIds) if (!input.moleIds.includes(id)) gains[id] = 2;
  }
  const headline = escapedMoleIds.length
    ? escapedMoleIds.length === input.moleIds.length ? 'THE MOLE ESCAPED!' : 'A MOLE SLIPPED AWAY!'
    : correctGuessMoleIds.length ? 'THE MOLE STOLE THE WORD!' : 'YOU CAUGHT THE MOLE!';
  return { accusedIds: input.accusedIds, moleIds: input.moleIds, caughtMoleIds, escapedMoleIds, correctGuessMoleIds, secretWord: input.word.display, gains, headline };
}

export function findWinners(scores: Record<string, number>, settings: GameSettings): string[] {
  if (settings.targetScore === null) return [];
  const qualified = Object.entries(scores).filter(([, score]) => score >= settings.targetScore!);
  if (!qualified.length) return [];
  const high = Math.max(...qualified.map(([, score]) => score));
  return qualified.filter(([, score]) => score === high).map(([id]) => id);
}

export type BotDifficulty = 'easy' | 'normal' | 'sneaky';
export type BotMind = { candidates: { word: string; confidence: number }[]; suspicion: Record<string, number> };
const PERSONALITIES: BotPersonality[] = ['confident', 'cautious', 'chaotic', 'detective', 'quiet', 'bluffing', 'literal', 'creative'];

export function randomPersonality(random: () => number = Math.random): BotPersonality {
  return PERSONALITIES[Math.floor(random() * PERSONALITIES.length)]!;
}

export function innocentBotClue(word: WordEntry, usedClues: string[], difficulty: BotDifficulty, random: () => number = Math.random): string {
  const choices = word.safeBotClues.filter((clue) => !usedClues.some((used) => normalizeGuess(used) === normalizeGuess(clue)));
  const safe = choices.length ? choices : ['familiar', 'recognizable', 'classic'];
  const indexBias = difficulty === 'easy' ? 0 : difficulty === 'sneaky' ? safe.length - 1 : Math.floor(safe.length / 2);
  const index = Math.max(0, Math.min(safe.length - 1, Math.round((indexBias + random() * safe.length) / 2)));
  return safe[index]!;
}

export function validateBotClue(clue: string, word: WordEntry, maxLength: number): boolean {
  const normalized = normalizeGuess(clue);
  if (!normalized || clue.length > maxLength) return false;
  const secrets = [word.display, ...(word.aliases ?? [])].map(normalizeGuess);
  return !secrets.some((secret) => normalized.includes(secret) || secret.includes(normalized));
}

export function updateMoleCandidates(mind: BotMind, clue: string, candidateWords: WordEntry[]): BotMind {
  const clueTerms = new Set(normalizeGuess(clue).split(' '));
  const candidates = candidateWords.map((word) => {
    const previous = mind.candidates.find((item) => item.word === word.display)?.confidence ?? 0.1;
    const evidence = [...word.tags, ...word.safeBotClues].some((term) => [...clueTerms].some((part) => normalizeGuess(term).includes(part))) ? 0.3 : -0.02;
    return { word: word.display, confidence: Math.max(0.01, previous + evidence) };
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 12);
  return { ...mind, candidates };
}

export function moleBotClue(mind: BotMind, observedClues: string[], difficulty: BotDifficulty, random: () => number = Math.random): string {
  const generic = ['popular', 'memorable', 'classic', 'everyday', 'recognizable'];
  if (difficulty === 'easy' || !mind.candidates.length) return generic[Math.floor(random() * generic.length)]!;
  const mimic = observedClues.filter((clue) => clue.length < 24).at(-1);
  if (difficulty === 'sneaky' && mimic && random() > 0.45) return mimic.split(' ')[0] ?? 'familiar';
  return generic[Math.floor(random() * generic.length)]!;
}

export function botVote(
  selfId: string,
  playerIds: string[],
  clues: Record<string, string>,
  role: 'innocent' | 'mole',
  word: WordEntry | null,
  difficulty: BotDifficulty,
  random: () => number = Math.random
): string {
  const candidates = playerIds.filter((id) => id !== selfId);
  const scored = candidates.map((id) => {
    const clue = clues[id] ?? '';
    let suspicion = 0.2 + random() * (difficulty === 'easy' ? 1.2 : 0.55);
    if (!clue || clue.length < 3) suspicion += 0.8;
    if (role === 'innocent' && word) {
      const related = [...word.tags, ...word.safeBotClues].some((tag) => normalizeGuess(clue).includes(normalizeGuess(tag)));
      suspicion += related ? -0.35 : difficulty === 'sneaky' ? 0.85 : 0.5;
    }
    return { id, suspicion };
  }).sort((a, b) => b.suspicion - a.suspicion);
  return scored[0]?.id ?? candidates[0]!;
}
