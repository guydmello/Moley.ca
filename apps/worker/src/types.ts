import type { BotDifficulty, BotMind } from '@moley/game-core';
import type { BotPersonality, ChatMessage, GameSettings, GameStage, PlayerKind, RoundResult } from '@moley/shared';
import type { WordEntry } from '@moley/word-packs';

export type StoredPlayer = {
  id: string;
  name: string;
  kind: PlayerKind;
  reconnectToken: string;
  score: number;
  roundGain: number;
  host: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeen: number;
  reservedUntil: number | null;
  ready: boolean;
  role: 'innocent' | 'mole' | 'spectator' | null;
  moleRounds: number[];
  clue: string | null;
  clueRevealed: boolean;
  clueSkipped: boolean;
  vote: string | null;
  guess: string | null;
  guessCorrect?: boolean;
  difficulty?: BotDifficulty;
  personality?: BotPersonality;
  botMind?: BotMind;
  queuedForNextRound?: boolean;
};

export type RoomState = {
  initialized: boolean;
  code: string;
  createdAt: number;
  updatedAt: number;
  stage: GameStage;
  roundNumber: number;
  settings: GameSettings;
  players: StoredPlayer[];
  turnOrder: string[];
  currentTurn: number;
  word: WordEntry | null;
  usedWordIds: string[];
  moleIds: string[];
  accusedIds: string[];
  votesRevealed: Record<string, number> | null;
  chat: ChatMessage[];
  timerEndsAt: number | null;
  timerPausedRemaining: number | null;
  result: RoundResult | null;
  winners: string[];
  message: string | null;
  serverSequence: number;
  processedEvents: string[];
};

export type Env = {
  GAME_ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
  AI?: Ai;
  AI_MODEL?: string;
  LOAD_TEST?: string;
};
