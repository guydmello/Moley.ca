import { z } from 'zod';

export const APP_VERSION = '2.5.0';
export const PROTOCOL_VERSION = 3 as const;
export const MIN_PROTOCOL_VERSION = 3;
export const MAX_PROTOCOL_VERSION = 3;
export const ROOM_CODE_WORDS = 4;
export const MAX_NAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 280;
export const MAX_CLUE_LENGTH = 80;
export const MAX_NOTE_LENGTH = 800;
export const MAX_DRAWING_STROKES = 32;
export const MAX_DRAWING_POINTS = 240;
export const MAX_WEBSOCKET_MESSAGE_LENGTH = 128 * 1024;

export const ROOM_CODE_PARTS = [
  ['amber', 'blue', 'brave', 'bright', 'calm', 'cozy', 'crisp', 'dapper', 'fuzzy', 'gentle', 'golden', 'happy', 'jolly', 'kind', 'lucky', 'minty', 'navy', 'peach', 'plucky', 'quick', 'quiet', 'rosy', 'silver', 'snug', 'soft', 'sunny', 'swift', 'tiny', 'violet', 'warm', 'wild', 'zesty'],
  ['badger', 'beaver', 'bison', 'bunny', 'comet', 'corgi', 'crow', 'duck', 'falcon', 'fox', 'frog', 'gecko', 'goose', 'heron', 'koala', 'llama', 'mole', 'moose', 'otter', 'owl', 'panda', 'puffin', 'raven', 'robin', 'seal', 'sloth', 'sparrow', 'tiger', 'turtle', 'walrus', 'whale', 'wolf'],
  ['acorn', 'apple', 'biscuit', 'cake', 'cloud', 'drum', 'feather', 'kite', 'lantern', 'leaf', 'maple', 'moon', 'pea', 'pebble', 'pencil', 'rocket', 'shell', 'snow', 'spoon', 'star', 'stone', 'toast', 'tree', 'tunnel', 'waffle', 'wave', 'whistle', 'willow', 'window', 'yarn', 'zipper', 'candle', 'canoe'],
  ['bay', 'bridge', 'brook', 'cabin', 'cave', 'cove', 'dune', 'field', 'forest', 'garden', 'grove', 'harbour', 'hill', 'island', 'lake', 'lane', 'marsh', 'meadow', 'orchard', 'park', 'path', 'pond', 'ridge', 'river', 'shore', 'summit', 'trail', 'valley', 'village', 'woods', 'yard', 'beach']
] as const;

export const featureLifecycleSchema = z.enum(['development', 'beta', 'production', 'disabled']);
export type FeatureLifecycle = z.infer<typeof featureLifecycleSchema>;
export const featureKeySchema = z.enum([
  'ai', 'chat', 'customPacks', 'drawing', 'spectatorPredictions', 'externalSharing',
  'cosmetics', 'chaos', 'audience', 'careerStats', 'french'
]);
export type FeatureKey = z.infer<typeof featureKeySchema>;
export type FeatureFlags = Record<FeatureKey, FeatureLifecycle>;
export const defaultFeatureFlags: FeatureFlags = {
  ai: 'production', chat: 'production', customPacks: 'beta', drawing: 'beta',
  spectatorPredictions: 'beta', externalSharing: 'production', cosmetics: 'beta',
  chaos: 'beta', audience: 'beta', careerStats: 'production', french: 'beta'
};
export const featureEnabled = (flags: FeatureFlags, key: FeatureKey): boolean => !['disabled', 'development'].includes(flags[key]);

export const stageSchema = z.enum([
  'ROOM_LOBBY', 'ROUND_SETUP', 'ROLE_REVEAL', 'ROLE_READY', 'CLUE_PREPARATION',
  'CLUE_TURN', 'DISCUSSION', 'VOTING', 'VOTE_REVEAL', 'TIE_RESOLUTION',
    'DEFENCE', 'REVOTE', 'ACCUSATION', 'MOLE_GUESS', 'ROUND_REVEAL', 'ROUND_RECAP', 'ROUND_SCORING', 'SCOREBOARD',
  'MATCH_COMPLETE'
]);
export type GameStage = z.infer<typeof stageSchema>;

export const settingsSchema = z.object({
  preset: z.enum(['classic', 'online', 'party', 'quick', 'big-group', 'family', 'chaos', 'sweaty', 'custom']).default('classic'),
  clueMode: z.enum(['spoken', 'typed', 'emoji', 'drawing']).default('spoken'),
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
  defenceSeconds: z.number().int().min(0).max(180).default(0),
  allowRevote: z.boolean().default(false),
  anonymousClues: z.boolean().default(false),
  forbiddenClueWords: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  privateNotebook: z.boolean().default(false),
  confidenceVoting: z.boolean().default(false),
  voteReveal: z.enum(['all-at-once', 'incremental', 'anonymous']).default('all-at-once'),
  secretReactions: z.boolean().default(false),
  spectatorPredictions: z.boolean().default(false),
  audienceReactions: z.boolean().default(false),
  chaosMode: z.boolean().default(false),
  chaosIntensity: z.enum(['mild', 'wild']).default('mild'),
  wordDifficulty: z.enum(['mixed', 'easy', 'medium', 'hard']).default('mixed'),
  contentLevel: z.enum(['family', 'teen', 'anything']).default('family'),
  wordBlacklist: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
  preventRecentWords: z.number().int().min(0).max(200).default(40),
  roomTheme: z.enum(['classic', 'northern-lights', 'campfire', 'arcade', 'ice-rink']).default('classic'),
  showIcebreakers: z.boolean().default(false),
  afkAutopilot: z.boolean().default(false),
  crowdPack: z.boolean().default(false),
  locked: z.boolean().default(false)
});
export type GameSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: GameSettings = settingsSchema.parse({});

export const presetSettings: Record<Exclude<GameSettings['preset'], 'custom'>, GameSettings> = {
  classic: settingsSchema.parse({ preset: 'classic' }),
  online: settingsSchema.parse({ preset: 'online', clueMode: 'typed', discussionChat: true, rapidSeconds: 45 }),
  party: settingsSchema.parse({ preset: 'party', targetScore: 7, showIcebreakers: true, secretReactions: true, defenceSeconds: 20 }),
  quick: settingsSchema.parse({ preset: 'quick', targetScore: 3, discussionSeconds: 30, votingSeconds: 15, guessSeconds: 15, rapidSeconds: 20 }),
  'big-group': settingsSchema.parse({ preset: 'big-group', discussionSeconds: 90, votingSeconds: 45, confidenceVoting: true, voteReveal: 'anonymous' }),
  family: settingsSchema.parse({ preset: 'family', familyFriendly: true, contentLevel: 'family', wordDifficulty: 'easy', targetScore: 5 }),
  chaos: settingsSchema.parse({ preset: 'chaos', chaosMode: true, chaosIntensity: 'wild', secretReactions: true, defenceSeconds: 15, voteReveal: 'incremental' }),
  sweaty: settingsSchema.parse({ preset: 'sweaty', wordDifficulty: 'hard', discussionSeconds: 120, confidenceVoting: true, defenceSeconds: 30, allowRevote: true, targetScore: 10 })
};

export function settingsForPreset(preset: GameSettings['preset']): GameSettings {
  return preset === 'custom' ? { ...defaultSettings, preset } : { ...presetSettings[preset] };
}

export function modifiedSettingKeys(settings: GameSettings): (keyof GameSettings)[] {
  if (settings.preset === 'custom') return [];
  const baseline = presetSettings[settings.preset];
  return (Object.keys(settings) as (keyof GameSettings)[]).filter((key) => key !== 'preset' && JSON.stringify(settings[key]) !== JSON.stringify(baseline[key]));
}

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
  clueDrawing?: DrawingPayload;
  clueStatus?: 'waiting' | 'submitted' | 'revealed' | 'skipped';
  symbol?: string;
  afk?: boolean;
  autopilot?: boolean;
  personality?: BotPersonality;
};

export const drawingPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
export const drawingStrokeSchema = z.object({ points: z.array(drawingPointSchema).min(1).max(200), color: z.enum(['ink', 'red', 'blue', 'green']).default('ink'), width: z.number().min(0.002).max(0.04).default(0.012) });
export const drawingPayloadSchema = z.object({ strokes: z.array(drawingStrokeSchema).min(1).max(MAX_DRAWING_STROKES) }).superRefine((value, ctx) => {
  if (value.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) > MAX_DRAWING_POINTS) ctx.addIssue({ code: 'custom', message: 'Drawing has too many points.' });
});
export type DrawingPayload = z.infer<typeof drawingPayloadSchema>;

export type VoteRevealItem = { voterId: string | null; targetId: string; confidence: 1 | 2 | 3 };
export type ReactionSummary = Record<string, number>;
export type RoundHistory = {
  roundNumber: number; word: string; category: string; result: RoundResult;
  clues: { playerId: string; clue?: string; drawing?: DrawingPayload; anonymous: boolean }[];
  voteTotals: Record<string, number>; createdAt: number;
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
  featureFlags: FeatureFlags;
  appVersion: string;
  protocolRange: { min: number; max: number };
  voteRevealItems: VoteRevealItem[];
  reactions: ReactionSummary;
  predictionTotals: Record<string, number>;
  history: RoundHistory[];
  chaosModifier: string | null;
  anonymousClues: { id: string; clue?: string; drawing?: DrawingPayload }[];
  crowdWordCount: number;
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
  note: string;
  voteConfidence: 1 | 2 | 3 | null;
  prediction: string | null;
  reactionsUsed: string[];
  crowdWords: string[];
  forbiddenClueWords: string[];
  hostSettings: GameSettings | null;
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
  baseEvent.extend({ type: z.literal('submit_drawing'), drawing: drawingPayloadSchema }),
  baseEvent.extend({ type: z.literal('update_note'), note: z.string().max(MAX_NOTE_LENGTH) }),
  baseEvent.extend({ type: z.literal('finish_spoken_clue') }),
  baseEvent.extend({ type: z.literal('send_chat'), text: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }),
  baseEvent.extend({ type: z.literal('submit_vote'), playerId: z.string().min(8).max(80), confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2) }),
  baseEvent.extend({ type: z.literal('submit_prediction'), playerId: z.string().min(8).max(80) }),
  baseEvent.extend({ type: z.literal('send_reaction'), emoji: z.enum(['👍', '🤔', '😂', '😮', '🔥', '🕳️']) }),
  baseEvent.extend({ type: z.literal('submit_crowd_word'), word: z.string().trim().min(2).max(80) }),
  baseEvent.extend({ type: z.literal('submit_mole_guess'), guess: z.string().trim().min(1).max(80) }),
  baseEvent.extend({ type: z.literal('host_start') }),
  baseEvent.extend({ type: z.literal('host_advance') }),
  baseEvent.extend({ type: z.literal('host_pause') }),
  baseEvent.extend({ type: z.literal('host_resume') }),
  baseEvent.extend({ type: z.literal('host_add_time'), seconds: z.number().int().min(5).max(300) }),
  baseEvent.extend({ type: z.literal('host_add_bot'), name: z.string().trim().max(MAX_NAME_LENGTH).optional(), difficulty: z.enum(['easy', 'normal', 'sneaky']).optional() }),
  baseEvent.extend({ type: z.literal('host_quick_fill'), targetSeats: z.number().int().min(4).max(100) }),
  baseEvent.extend({ type: z.literal('host_rename_bot'), playerId: z.string(), name: z.string().trim().min(1).max(MAX_NAME_LENGTH) }),
  baseEvent.extend({ type: z.literal('host_set_bot_personality'), playerId: z.string(), personality: z.enum(['confident', 'cautious', 'chaotic', 'detective', 'quiet', 'bluffing', 'literal', 'creative']) }),
  baseEvent.extend({ type: z.literal('host_remove_bot'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_kick'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_transfer'), playerId: z.string() }),
  baseEvent.extend({ type: z.literal('host_judge_guess'), playerId: z.string(), correct: z.boolean() }),
  baseEvent.extend({ type: z.literal('host_restart_round') }),
  baseEvent.extend({ type: z.literal('host_end_match') }),
  baseEvent.extend({ type: z.literal('host_rematch'), mode: z.enum(['same', 'reset', 'settings']).default('same') }),
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
  compatibility?: { appVersion: string; minProtocol: number; maxProtocol: number; refreshRequired: boolean };
};

export type RuntimeConfig = {
  appVersion: string;
  protocol: number;
  protocolRange: { min: number; max: number };
  features: FeatureFlags;
  release: { title: string; publishedAt: string; highlights: string[] };
};

export function normalizeRoomCode(code: string): string {
  return code.toLocaleLowerCase('en-CA').replace(/[\s-]+/g, '').replace(/[^a-z]/g, '');
}

export function formatRoomCode(code: string): string {
  let rest = normalizeRoomCode(code);
  const parts: string[] = [];
  for (const list of ROOM_CODE_PARTS) {
    const found = [...list].sort((a, b) => b.length - a.length).find((word) => rest.startsWith(word));
    if (!found) break;
    parts.push(found);
    rest = rest.slice(found.length);
  }
  if (rest) parts.push(rest);
  return (parts.length ? parts : [normalizeRoomCode(code)]).join(' ').toLocaleUpperCase('en-CA');
}

export function normalizeName(name: string): string {
  return safeDisplayName(name).toLocaleLowerCase('en-CA');
}

export function safeDisplayName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[\p{Cc}\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_NAME_LENGTH);
}

export function normalizeGuess(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase('en-CA').replace(/\p{M}+/gu, '').replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
}
