import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;
export const ROOM_CODE_WORDS = 3;
export const MAX_NAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 280;
export const MAX_CLUE_LENGTH = 80;

export const stageSchema = z.enum([
  'ROOM_LOBBY', 'ROUND_SETUP', 'ROLE_REVEAL', 'ROLE_READY', 'CLUE_PREPARATION',
  'CLUE_TURN', 'DISCUSSION', 'VOTING', 'VOTE_REVEAL', 'TIE_RESOLUTION',
  'ACCUSATION', 'MOLE_GUESS', 'ROUND_REVEAL', 'ROUND_SCORING', 'SCOREBOARD',
  'MATCH_COMPLETE'
]);
export type GameStage = z.infer<typeof stageSchema>;

export const settingsSchema = z.object({
  preset: z.enum(['classic', 'online', 'party', 'big-group', 'custom']).default('classic'),
  clueMode: z.enum(['spoken', 'typed']).default('spoken'),
  guessMode: z.enum(['typed', 'spoken']).default('typed'),
  moleCount: z.number().int().min(1).max(20).nullable().default(null),
  blindMoles: z.boolean().default(false),
  targetScore: z.number().int().min(1).max(100).nullable().default(5),
  suddenDeath: z.boolean().default(false),
  rapidSeconds: z.number().int().min(0).max(300).default(0),
  discussionSeconds: z.number().int().min(0).max(1800).default(60),
  votingSeconds: z.number().int().min(0).max(600).default(30),
  guessSeconds: z.number().int().min(0).max(300).default(30),
  clueMaxLength: z.number().int().min(8).max(MAX_CLUE_LENGTH).default(40),
  oneWordClues: z.boolean().default(false),
  familyFriendly: z.boolean().default(true),
  categories: z.array(z.string().max(48)).max(80).default([]),
  customWords: z.array(z.string().trim().min(1).max(80)).max(1000).default([]),
  botDifficulty: z.enum(['easy', 'normal', 'sneaky']).default('normal'),
  lateJoin: z.enum(['next-round', 'spectator', 'block']).default('spectator'),
  discussionChat: z.boolean().default(true),
  moleKnowsCategory: z.boolean().default(true),
  sound: z.boolean().default(true),
  haptics: z.boolean().default(true),
  animations: z.boolean().default(true),
  locked: z.boolean().default(false)
});
export type GameSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: GameSettings = settingsSchema.parse({});

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type PlayerKind = 'human' | 'bot' | 'spectator';
export type BotPersonality = 'confident' | 'cautious' | 'chaotic' | 'detective' | 'quiet' | 'bluffing' | 'literal' | 'creative';

export type PublicPlayer = {
  id: string;
  name: string;
  kind: PlayerKind;
  score: number;
  roundGain: number;
  host: boolean;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
  clue?: string;
  clueStatus?: 'waiting' | 'submitted' | 'revealed' | 'skipped';
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  bot?: boolean;
};

export type PublicRoomState = {
  code: string;
  stage: GameStage;
  roundNumber: number;
  players: PublicPlayer[];
  settings: GameSettings;
  turnOrder: string[];
  currentTurn: number;
  readyCount: number;
  eligibleReadyCount: number;
  voteCount: number;
  eligibleVoteCount: number;
  accusedIds: string[];
  chat: ChatMessage[];
  timerEndsAt: number | null;
  timerPausedRemaining: number | null;
  category: string | null;
  revealedWord: string | null;
  result: RoundResult | null;
  winners: string[];
  message: string | null;
};

export type PrivateState = {
  playerId: string;
  role: 'innocent' | 'mole' | 'spectator' | null;
  secretWord: string | null;
  fellowMoleIds: string[];
  sessionToken: string;
  canHost: boolean;
  submittedVote: string | null;
  submittedClue: string | null;
  mustGuess: boolean;
  judgeMoleIds: string[];
};

export type RoundResult = {
  accusedIds: string[];
  moleIds: string[];
  caughtMoleIds: string[];
  escapedMoleIds: string[];
  correctGuessMoleIds: string[];
  secretWord: string;
  gains: Record<string, number>;
  headline: string;
};

const baseEvent = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().min(8).max(80),
  seq: z.number().int().nonnegative()
});

export const clientEventSchema = z.discriminatedUnion('type', [
  baseEvent.extend({ type: z.literal('heartbeat') }),
  baseEvent.extend({ type: z.literal('player_ready'), ready: z.boolean().default(true) }),
  baseEvent.extend({ type: z.literal('submit_clue'), clue: z.string().trim().min(1).max(MAX_CLUE_LENGTH) }),
  baseEvent.extend({ type: z.literal('finish_spoken_clue') }),
  baseEvent.extend({ type: z.literal('send_chat'), text: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }),
  baseEvent.extend({ type: z.literal('submit_vote'), playerId: z.string().min(8).max(80) }),
  baseEvent.extend({ type: z.literal('submit_mole_guess'), guess: z.string().trim().min(1).max(80) }),
  baseEvent.extend({ type: z.literal('host_start') }),
  baseEvent.extend({ type: z.literal('host_advance') }),
  baseEvent.extend({ type: z.literal('host_pause') }),
  baseEvent.extend({ type: z.literal('host_resume') }),
  baseEvent.extend({ type: z.literal('host_add_time'), seconds: z.number().int().min(5).max(300) }),
  baseEvent.extend({ type: z.literal('host_add_bot'), name: z.string().trim().max(MAX_NAME_LENGTH).optional(), difficulty: z.enum(['easy', 'normal', 'sneaky']).optional() }),
  baseEvent.extend({ type: z.literal('host_remove_bot'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_kick'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_transfer'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_judge_guess'), playerId: z.string(), correct: z.boolean() }),
  baseEvent.extend({ type: z.literal('host_restart_round') }),
  baseEvent.extend({ type: z.literal('host_end_match') }),
  baseEvent.extend({ type: z.literal('host_rematch') }),
  baseEvent.extend({ type: z.literal('update_settings'), settings: settingsSchema.partial() })
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;

export type ServerEnvelope = {
  v: typeof PROTOCOL_VERSION;
  id: string;
  seq: number;
  ts: number;
  type: 'room_snapshot' | 'pong' | 'error' | 'notification';
  public?: PublicRoomState;
  private?: PrivateState;
  message?: string;
  code?: string;
};

export function normalizeRoomCode(code: string): string {
  return code.toLocaleLowerCase('en-CA').replace(/[\s-]+/g, '').replace(/[^a-z]/g, '');
}

export function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-CA');
}

export function safeDisplayName(name: string): string {
  return name.normalize('NFKC').replace(/\p{Cc}/gu, '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
}

export function normalizeGuess(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase('en-CA').replace(/\p{M}+/gu, '').replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
}
