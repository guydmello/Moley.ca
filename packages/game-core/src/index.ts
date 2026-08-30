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
  VOTE_REVEAL: ['TIE_RESOLUTION', 'DEFENCE', 'ACCUSATION'],
  TIE_RESOLUTION: ['DEFENCE', 'ACCUSATION'],
  DEFENCE: ['REVOTE', 'ACCUSATION'],
  REVOTE: ['VOTE_REVEAL'],
  ACCUSATION: ['MOLE_GUESS', 'ROUND_REVEAL'],
  MOLE_GUESS: ['MOLE_GUESS', 'ROUND_REVEAL'],
  ROUND_REVEAL: ['ROUND_RECAP'],
  ROUND_RECAP: ['ROUND_SCORING', 'SCOREBOARD', 'MATCH_COMPLETE'],
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

export const BOARD_SIZES = [5, 6, 7, 8, 9, 10] as const;
export type BoardSize = typeof BOARD_SIZES[number];

export function isBoardSize(value: number): value is BoardSize {
  return Number.isInteger(value) && BOARD_SIZES.includes(value as BoardSize);
}

/**
 * A stricter key than display normalization. It collapses punctuation,
 * diacritics and conservative English plural variants so crafted packs cannot
 * place APPLE / apples or BERRY / berries on the same board.
 */
export function normalizeWordKey(value: string): string {
  const normalized = normalizeGuess(value);
  const terms = normalized.split(' ').filter(Boolean);
  const last = terms.at(-1);
  if (!last || last.length <= 3) return normalized;
  if (last.endsWith('ies') && last.length > 4) terms[terms.length - 1] = `${last.slice(0, -3)}y`;
  else if (/(ches|shes|xes|zes)$/.test(last)) terms[terms.length - 1] = last.slice(0, -2);
  else if (last.endsWith('s') && !last.endsWith('ss')) terms[terms.length - 1] = last.slice(0, -1);
  return terms.join(' ');
}

export function dedupeWords(catalog: WordEntry[]): WordEntry[] {
  const unique = new Map<string, WordEntry>();
  for (const word of catalog) {
    const key = normalizeWordKey(word.display);
    if (!key) continue;
    const existing = unique.get(key);
    if (!existing || (word.botEnabled && !existing.botEnabled)) unique.set(key, word);
  }
  return [...unique.values()];
}

export function customWordEntries(displays: string[], prefix = 'custom'): WordEntry[] {
  return dedupeWords(displays.map((display, index) => ({
    id: `${prefix}-${index}-${normalizeGuess(display).replaceAll(' ', '-')}`,
    display: display.trim(), aliases: [], category: 'Custom Pack', difficulty: 'medium' as const,
    tags: ['custom'], safeBotClues: [], botEnabled: false, familySafe: true,
    contentLevel: 'family' as const, pack: prefix
  })).filter((word) => Boolean(normalizeWordKey(word.display))));
}

export function filterWordCatalog(catalog: WordEntry[], settings: Pick<GameSettings, 'categories' | 'wordBlacklist' | 'wordDifficulty' | 'contentLevel'>): WordEntry[] {
  const selected = settings.categories.length ? new Set(settings.categories) : null;
  const blacklist = new Set(settings.wordBlacklist.map(normalizeWordKey));
  return dedupeWords(catalog.filter((word) =>
    (!selected || selected.has(word.category) || word.category === 'Custom Pack') &&
    !blacklist.has(normalizeWordKey(word.display)) &&
    (settings.wordDifficulty === 'mixed' || word.difficulty === settings.wordDifficulty) &&
    (settings.contentLevel !== 'family' || word.familySafe)
  ));
}

export function buildWordBoard(
  catalog: WordEntry[],
  boardSize: number,
  requiredWord: WordEntry | null = null,
  random: () => number = Math.random
): WordEntry[] {
  if (!isBoardSize(boardSize)) throw new Error('Board size must be between 5 and 10.');
  const unique = dedupeWords(catalog);
  const requiredKey = requiredWord ? normalizeWordKey(requiredWord.display) : null;
  const canonicalRequired = requiredWord
    ? unique.find((word) => normalizeWordKey(word.display) === requiredKey) ?? requiredWord
    : null;
  const pool = unique.filter((word) => !requiredKey || normalizeWordKey(word.display) !== requiredKey);
  const count = boardSize ** 2;
  const chosen = canonicalRequired
    ? [canonicalRequired, ...shuffled(pool, random).slice(0, count - 1)]
    : shuffled(pool, random).slice(0, count);
  if (chosen.length !== count) throw new Error(`This setup needs ${count} unique words for a ${boardSize}×${boardSize} board.`);
  return shuffled(chosen, random);
}

export function fairTurnOrder(ids: string[], recentFirstIds: string[], random: () => number = Math.random): string[] {
  const order = shuffled(ids, random);
  if (order.length < 2) return order;
  const recent = new Set(recentFirstIds.slice(-2));
  if (recent.has(order[0]!)) {
    const alternatives = order.map((id, index) => ({ id, index })).filter(({ id }) => !recent.has(id));
    if (alternatives.length && random() < 0.8) {
      const choice = alternatives[Math.floor(random() * alternatives.length)]!;
      [order[0], order[choice.index]] = [order[choice.index]!, order[0]!];
    }
  }
  return order;
}

export function newRoundTurnOrder(
  ids: string[],
  previousOrder: string[],
  recentFirstIds: string[],
  random: () => number = Math.random
): string[] {
  const order = fairTurnOrder(ids, recentFirstIds, random);
  if (order.length > 1 && order.length === previousOrder.length && order.every((id, index) => id === previousOrder[index])) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

export type ConfigurationContext = {
  availableWords: WordEntry[];
  fallbackBotWords?: WordEntry[];
  botCount: number;
  offline: boolean;
};

export type ConfigurationReview = { errors: string[]; warnings: string[] };

export function validateConfiguration(settings: GameSettings, context: ConfigurationContext): ConfigurationReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unique = dedupeWords(context.availableWords);
  if (!unique.length) errors.push('No words match this setup. Choose more categories or loosen the filters.');
  if (settings.boardEnabled && !isBoardSize(settings.boardSize)) errors.push('Board size must be between 5 and 10.');
  if (settings.boardEnabled && unique.length < settings.boardSize ** 2) errors.push(`Add at least ${settings.boardSize ** 2} unique words for this board.`);
  if (context.botCount > 0 && !unique.some((word) => word.botEnabled)) {
    if (dedupeWords(context.fallbackBotWords ?? []).some((word) => word.botEnabled)) warnings.push('A curated bot-supported secret outside the selected filters will be used; selected words still fill the board.');
    else errors.push('Games with bots need at least one audited bot-supported secret word.');
  }
  if (context.offline && settings.clueMode === 'drawing') warnings.push('Drawing clues are not available in Local Classic. Spoken clues will be used.');
  if (settings.allowRevote && settings.defenceSeconds <= 0) warnings.push('Revote requires a defence phase and will stay off.');
  return { errors, warnings };
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
  const moleGuesses = Object.fromEntries(caughtMoleIds.map((id) => [id, input.guesses[id]?.guess?.trim() || 'No guess']));
  const gains = Object.fromEntries(input.playerIds.map((id) => [id, 0]));
  for (const id of escapedMoleIds) gains[id] = 2;
  for (const id of correctGuessMoleIds) gains[id] = 1;
  if (caughtMoleIds.length === input.moleIds.length && correctGuessMoleIds.length === 0) {
    for (const id of input.playerIds) if (!input.moleIds.includes(id)) gains[id] = 2;
  }
  const headline = escapedMoleIds.length
    ? escapedMoleIds.length === input.moleIds.length ? 'THE MOLE ESCAPED!' : 'A MOLE SLIPPED AWAY!'
    : correctGuessMoleIds.length ? 'THE MOLE STOLE THE WORD!' : 'YOU CAUGHT THE MOLE!';
  return { accusedIds: input.accusedIds, moleIds: input.moleIds, caughtMoleIds, escapedMoleIds, correctGuessMoleIds, moleGuesses, secretWord: input.word.display, gains, headline };
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

export function normalizeClueKey(value: string): string {
  const normalized = normalizeGuess(value);
  return normalized.length > 4 && normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
}

function interleaveClues(...groups: string[][]): string[] {
  const result: string[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < longest; index++) for (const group of groups) if (group[index]) result.push(group[index]!);
  return result;
}

export function innocentBotClue(word: WordEntry, usedClues: string[], difficulty: BotDifficulty, random: () => number = Math.random, personality: BotPersonality = 'detective'): string {
  const groups = word.botClues;
  const indirectConcepts = groups ? [...groups.medium, ...groups.subtle, ...(word.relatedConcepts ?? []), ...word.tags, word.category] : [...word.safeBotClues, ...(word.relatedConcepts ?? []), ...word.tags, word.category];
  const composite = indirectConcepts.flatMap((left, index) => indirectConcepts.slice(index + 1).map((right) => `${left} · ${right}`));
  const ordered = groups
    ? difficulty === 'easy' ? [...interleaveClues(groups.direct, groups.medium), ...groups.subtle]
      : difficulty === 'sneaky' || ['creative', 'cautious', 'quiet'].includes(personality) ? [...interleaveClues(groups.subtle, groups.medium), ...composite, ...groups.direct]
        : [...interleaveClues(groups.medium, groups.subtle), ...composite, ...groups.direct]
    : word.safeBotClues;
  const used = new Set(usedClues.map(normalizeClueKey));
  const valid = ordered.filter((clue) => !used.has(normalizeClueKey(clue)) && validateBotClue(clue, word, 80));
  const secondary = [...(word.relatedConcepts ?? []), ...word.tags, word.category].filter((clue) => !used.has(normalizeClueKey(clue)) && validateBotClue(clue, word, 80));
  const safe = valid.length ? valid : secondary;
  if (!safe.length) return `related to ${word.category.toLocaleLowerCase('en-CA')}`;
  const window = personality === 'chaotic' ? safe : safe.slice(0, Math.min(4, safe.length));
  return window[Math.floor(random() * window.length)]!;
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
    const knowledge = [...word.tags, ...word.safeBotClues, ...(word.relatedConcepts ?? [])];
    const matches = knowledge.filter((term) => [...clueTerms].some((part) => normalizeGuess(term).includes(part) || part.includes(normalizeGuess(term)))).length;
    const evidence = matches ? 0.22 + matches * 0.12 : -0.02;
    return { word: word.display, confidence: Math.max(0.01, previous + evidence) };
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 12);
  return { ...mind, candidates };
}

export function moleBotClue(mind: BotMind, observedClues: string[], difficulty: BotDifficulty, random: () => number = Math.random): string {
  const broad = ['category fit', 'commonly known', 'widely seen', 'recognizable'];
  if (difficulty === 'easy' || !mind.candidates.length) return broad[Math.floor(random() * broad.length)]!;
  const fresh = broad.filter((clue) => !observedClues.some((used) => normalizeClueKey(used) === normalizeClueKey(clue)));
  return (fresh.length ? fresh : broad)[Math.floor(random() * (fresh.length || broad.length))]!;
}

export function moleBotClueFromCandidates(
  mind: BotMind,
  observedClues: string[],
  candidateWords: WordEntry[],
  usedClues: string[],
  difficulty: BotDifficulty,
  personality: BotPersonality,
  random: () => number = Math.random
): string {
  const confidence = mind.candidates[0]?.confidence ?? 0;
  const guess = candidateWords.find((word) => word.display === mind.candidates[0]?.word);
  if (guess && confidence >= (difficulty === 'sneaky' ? 0.25 : 0.45)) return innocentBotClue(guess, [...usedClues, ...observedClues], difficulty === 'easy' ? 'normal' : 'sneaky', random, personality);
  const category = candidateWords[0]?.category ?? 'the category';
  const broad = [`fits ${category}`, `common in ${category}`, category.toLocaleLowerCase('en-CA')];
  const used = new Set([...usedClues, ...observedClues].map(normalizeClueKey));
  return broad.find((clue) => !used.has(normalizeClueKey(clue))) ?? 'loosely connected';
}

export function moleBotGuess(
  mind: BotMind,
  candidateWords: WordEntry[],
  difficulty: BotDifficulty,
  random: () => number = Math.random
): string {
  const ranked = mind.candidates
    .map((candidate) => candidateWords.find((word) => word.display === candidate.word))
    .filter((word): word is WordEntry => Boolean(word));
  const fallback = ranked.length ? ranked : candidateWords;
  if (!fallback.length) return 'I have no idea';
  const window = difficulty === 'easy' ? fallback.slice(0, 6) : difficulty === 'sneaky' ? fallback.slice(0, 2) : fallback.slice(0, 3);
  const topBias = difficulty === 'sneaky' ? 0.78 : difficulty === 'normal' ? 0.58 : 0.34;
  if (random() < topBias) return window[0]!.display;
  return window[Math.floor(random() * window.length)]!.display;
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

export function botDiscussionLine(
  speakerName: string,
  targetName: string,
  targetClue: string,
  related: boolean,
  personality: BotPersonality,
  usedLines: string[],
  random: () => number = Math.random
): string {
  const weak = !targetClue || targetClue === 'Spoken clue' || targetClue.length < 4;
  const templates = weak
    ? [`${targetName}'s clue felt pretty broad.`, `I wanted more from ${targetName}'s clue.`, `${targetName} gave us very little to work with.`]
    : related
      ? [`${targetName}'s clue connected for me.`, `${targetName} took a believable angle.`, `I can follow what ${targetName} was getting at.`]
      : [`I'm keeping an eye on ${targetName}.`, `${targetName}'s angle did not quite land for me.`, `${targetName} feels worth questioning.`];
  const ordered = personality === 'confident' || personality === 'detective' ? templates : shuffled(templates, random);
  const used = new Set(usedLines.map(normalizeClueKey));
  const text = ordered.find((line) => !used.has(normalizeClueKey(line))) ?? `${speakerName} is still deciding.`;
  return `${speakerName}: ${text}`;
}

export * from './local';
