import { DurableObject } from 'cloudflare:workers';
import {
  assignMoles, autoMoleCount, botVote, findWinners, innocentBotClue, moleBotClue,
  randomPersonality, rankVotes, resolveTie, scoreRound, shuffled, updateMoleCandidates, validateBotClue
} from '@moley/game-core';
import {
  APP_VERSION, MAX_PROTOCOL_VERSION, MAX_WEBSOCKET_MESSAGE_LENGTH, MIN_PROTOCOL_VERSION, clientEventSchema, defaultSettings, featureEnabled, normalizeGuess, normalizeName, PROTOCOL_VERSION, settingsSchema,
  type ClientEvent, type PrivateState, type PublicRoomState, type ServerEnvelope
} from '@moley/shared';
import { pickWord, words } from '@moley/word-packs';
import { BotAI } from '../ai';
import { isAllowedOrigin, json, newId, newSecret, SlidingRateLimit, validateName } from '../security';
import type { Env, RoomState, StoredPlayer } from '../types';
import { runtimeFeatures } from '../features';
import { publicSettings } from '../projections';

type SocketAttachment = { playerId: string; connectedAt: number; lastSeq: number };

const emptyState = (): RoomState => ({
  initialized: false,
  code: '',
  createdAt: 0,
  updatedAt: 0,
  stage: 'ROOM_LOBBY',
  roundNumber: 0,
  settings: defaultSettings,
  players: [],
  turnOrder: [],
  currentTurn: 0,
  word: null,
  usedWordIds: [],
  moleIds: [],
  accusedIds: [],
  votesRevealed: null,
  chat: [],
  timerEndsAt: null,
  timerPausedRemaining: null,
  result: null,
  winners: [],
  message: null,
  serverSequence: 0,
  processedEvents: []
  ,featureFlags: { ai: 'production', chat: 'production', customPacks: 'beta', drawing: 'beta', spectatorPredictions: 'beta', externalSharing: 'production', cosmetics: 'beta', chaos: 'beta', audience: 'beta', careerStats: 'production', french: 'beta' }
  ,voteRevealItems: []
  ,reactions: {}
  ,history: []
  ,chaosModifier: null
  ,revoteUsed: false
  ,crowdWords: []
});

export class GameRoom extends DurableObject<Env> {
  private room: RoomState = emptyState();
  private ai: BotAI;
  private rate = new SlidingRateLimit();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ai = new BotAI(env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at INTEGER NOT NULL)');
      const rows = [...this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM room_state WHERE id = 1')];
      if (rows[0]) this.room = this.normalizeStoredState(JSON.parse(rows[0].json) as Partial<RoomState>);
      this.room.featureFlags = runtimeFeatures(env);
      for (const socket of this.ctx.getWebSockets()) {
        const attachment = socket.deserializeAttachment() as SocketAttachment | null;
        const player = attachment ? this.player(attachment.playerId) : null;
        if (player) { player.connected = true; player.lastSeen = Date.now(); }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    this.room.featureFlags = runtimeFeatures(this.env);
    const url = new URL(request.url);
    if (url.pathname === '/status') return json({ initialized: this.room.initialized, code: this.room.code, stage: this.room.stage, seats: this.activeSeats().length });
    if (url.pathname === '/create' && request.method === 'POST') return this.create(await request.json().catch(() => null));
    if (url.pathname === '/join' && request.method === 'POST') return this.join(await request.json().catch(() => null), request.headers.get('X-Moley-Network-Key') ?? 'unknown');
    if (url.pathname === '/connect') return this.connectWebSocket(request, url.searchParams.get('clientVersion') ?? '', Number(url.searchParams.get('protocol')));
    return json({ error: 'Tunnel not found.' }, 404);
  }

  private async create(body: unknown): Promise<Response> {
    if (this.room.initialized) return json({ error: 'That room already exists.' }, 409);
    const parsed = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const nameResult = validateName(parsed.name, []);
    if (!nameResult.ok) return json({ error: nameResult.error }, 400);
    const settings = settingsSchema.safeParse(parsed.settings ?? {});
    if (!settings.success) return json({ error: 'One of those game settings needs another look.' }, 400);
    const now = Date.now();
    const host: StoredPlayer = {
      id: newId('player'), name: nameResult.name, kind: 'human', reconnectToken: newSecret(),
      score: 0, roundGain: 0, host: true, connected: false, joinedAt: now, lastSeen: now,
      reservedUntil: null, ready: false, role: null, moleRounds: [], clue: null,
      clueRevealed: false, clueSkipped: false, vote: null, guess: null
      ,clueDrawing: null, note: '', voteConfidence: null, prediction: null, reactionsUsed: [], afk: false, autopilot: false
    };
    this.room = { ...emptyState(), initialized: true, code: String(parsed.code ?? ''), createdAt: now, updatedAt: now, settings: settings.data, players: [host] };
    await this.persist();
    this.metric('room_created', { seats: 1 });
    return json({ code: this.room.code, playerId: host.id, sessionToken: host.reconnectToken, snapshot: this.snapshot(host) }, 201);
  }

  private async join(body: unknown, networkKey: string): Promise<Response> {
    if (!this.room.initialized) return json({ error: 'We could not find that room. Check the code and try again.' }, 404);
    if (this.env.LOAD_TEST !== 'true' && !this.rate.allow(`join:${networkKey}`, 120, 60_000)) return json({ error: 'This room is receiving too many join attempts. Please wait a moment.' }, 429);
    const parsed = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const requestedSpectator = parsed.spectator === true;
    const queuedForNextRound = !requestedSpectator && this.room.stage !== 'ROOM_LOBBY' && this.room.settings.lateJoin !== 'block';
    const asSpectator = requestedSpectator || queuedForNextRound;
    if (this.room.settings.locked) return json({ error: 'This room is locked right now.' }, 423);
    if (this.room.stage !== 'ROOM_LOBBY' && this.room.settings.lateJoin === 'block' && !asSpectator) return json({ error: 'This match has already started.' }, 409);
    if (!asSpectator && this.activeSeats().length >= 100) return json({ error: 'This room already has the maximum 100 players.' }, 409);
    if (asSpectator && this.room.players.filter((player) => player.kind === 'spectator').length >= 200) return json({ error: 'The audience is full right now.' }, 409);
    const nameResult = validateName(parsed.name, this.room.players);
    if (!nameResult.ok) return json({ error: nameResult.error }, 400);
    const now = Date.now();
    const player: StoredPlayer = {
      id: newId(asSpectator ? 'spectator' : 'player'), name: nameResult.name, kind: asSpectator ? 'spectator' : 'human', reconnectToken: newSecret(),
      score: 0, roundGain: 0, host: false, connected: false, joinedAt: now, lastSeen: now,
      reservedUntil: null, ready: false, role: asSpectator ? 'spectator' : null, moleRounds: [],
      clue: null, clueRevealed: false, clueSkipped: false, vote: null, guess: null, queuedForNextRound
      ,clueDrawing: null, note: '', voteConfidence: null, prediction: null, reactionsUsed: [], afk: false, autopilot: false
    };
    this.room.players.push(player);
    await this.persist();
    this.broadcast(`${player.name} joined the room.`);
    return json({ code: this.room.code, playerId: player.id, sessionToken: player.reconnectToken, spectator: asSpectator, snapshot: this.snapshot(player) }, 201);
  }

  private connectWebSocket(request: Request, clientVersion: string, protocol: number): Response {
    if (request.headers.get('Upgrade')?.toLocaleLowerCase() !== 'websocket') return json({ error: 'A live connection is required.' }, 426);
    if (!Number.isInteger(protocol) || protocol < MIN_PROTOCOL_VERSION || protocol > MAX_PROTOCOL_VERSION) {
      return json({ error: 'This Moley tab needs a refresh before it can rejoin.', code: 'CLIENT_UPDATE_REQUIRED', compatibility: { appVersion: APP_VERSION, minProtocol: MIN_PROTOCOL_VERSION, maxProtocol: MAX_PROTOCOL_VERSION, refreshRequired: true } }, 426);
    }
    if (!clientVersion) return json({ error: 'Client version is required.', code: 'CLIENT_UPDATE_REQUIRED' }, 426);
    const origin = request.headers.get('Origin');
    if (this.env.LOAD_TEST !== 'true' && !isAllowedOrigin(origin)) return json({ error: 'That connection origin is not allowed.' }, 403);
    const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((value) => value.trim());
    if (!protocols.includes(`moley.v${PROTOCOL_VERSION}`)) return json({ error: 'The live connection protocol is missing.' }, 426);
    const token = protocols.find((value) => value.startsWith('session.'))?.slice('session.'.length) ?? '';
    const player = this.room.players.find((candidate) => candidate.reconnectToken === token);
    if (!player || token.length < 20) return json({ error: 'This reconnect link is no longer valid.' }, 401);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.serializeAttachment({ playerId: player.id, connectedAt: Date.now(), lastSeq: -1 } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server, [player.id]);
    for (const existing of this.ctx.getWebSockets(player.id)) {
      if (existing !== server && existing.readyState === WebSocket.OPEN) existing.close(4001, 'Session moved to another tab');
    }
    player.connected = true;
    player.afk = false;
    player.autopilot = false;
    player.lastSeen = Date.now();
    player.reservedUntil = null;
    this.ctx.waitUntil(this.persist());
    this.send(server, player);
    this.broadcast(`${player.name} is connected.`);
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': `moley.v${PROTOCOL_VERSION}` } });
  }

  private normalizeStoredState(raw: Partial<RoomState>): RoomState {
    const base = emptyState();
    const settings = settingsSchema.parse({ ...defaultSettings, ...(raw.settings ?? {}) });
    return {
      ...base, ...raw, settings,
      featureFlags: runtimeFeatures(this.env),
      players: (raw.players ?? []).map((player) => ({
        ...player,
        clueDrawing: player.clueDrawing ?? null,
        note: player.note ?? '', voteConfidence: player.voteConfidence ?? null,
        prediction: player.prediction ?? null, reactionsUsed: player.reactionsUsed ?? [],
        afk: player.afk ?? false, autopilot: player.autopilot ?? false
      })),
      voteRevealItems: raw.voteRevealItems ?? [], reactions: raw.reactions ?? {},
      history: (raw.history ?? []).slice(-24), chaosModifier: raw.chaosModifier ?? null,
      revoteUsed: raw.revoteUsed ?? false
      ,crowdWords: raw.crowdWords ?? []
    } as RoomState;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.room.featureFlags = runtimeFeatures(this.env);
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = attachment ? this.player(attachment.playerId) : null;
    if (!attachment || !player) { socket.close(1008, 'Invalid session'); return; }
    this.ensureHostPresence();
    player.lastSeen = Date.now();
    if (typeof message !== 'string' || message.length > MAX_WEBSOCKET_MESSAGE_LENGTH) { this.error(socket, 'That message was too large.'); return; }
    if (!this.rate.allow(`event:${player.id}`, 60, 10_000)) { this.error(socket, 'Slow down for a moment.'); return; }
    let raw: unknown;
    try { raw = JSON.parse(message); } catch { this.error(socket, 'Moley could not understand that message.'); return; }
    const parsed = clientEventSchema.safeParse(raw);
    if (!parsed.success) { this.error(socket, 'That action is not valid right now.'); return; }
    const event = parsed.data;
    if (event.seq <= attachment.lastSeq) { this.error(socket, 'That action is stale or duplicated.'); return; }
    socket.serializeAttachment({ ...attachment, lastSeq: event.seq } satisfies SocketAttachment);
    if (event.type === 'heartbeat') {
      const envelope: ServerEnvelope = { v: PROTOCOL_VERSION, id: newId('event'), seq: ++this.room.serverSequence, ts: Date.now(), type: 'pong' };
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(envelope));
      return;
    }
    if (this.room.processedEvents.includes(event.id)) { this.send(socket, player); return; }
    this.room.processedEvents = [...this.room.processedEvents.slice(-499), event.id];
    try {
      await this.handleEvent(player, event);
      await this.persist();
      this.broadcast();
    } catch (error) {
      this.error(socket, error instanceof Error ? error.message : 'Moley hit a wall in the tunnel. Try again.');
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = attachment ? this.player(attachment.playerId) : null;
    if (!player) return;
    const hasAnotherSocket = this.ctx.getWebSockets(player.id).some((candidate) => candidate !== socket && candidate.readyState === WebSocket.OPEN);
    if (hasAnotherSocket) return;
    player.connected = false;
    player.afk = true;
    if (this.room.settings.afkAutopilot && !['ROOM_LOBBY', 'MATCH_COMPLETE'].includes(this.room.stage) && player.kind === 'human') player.autopilot = true;
    player.lastSeen = Date.now();
    player.reservedUntil = Date.now() + 120_000;
    await this.persist();
    await this.scheduleAt(Date.now() + (player.host ? 10_000 : 120_000));
    this.broadcast(`${player.name} disconnected.`);
  }

  async webSocketError(socket: WebSocket): Promise<void> { await this.webSocketClose(socket); }

  async alarm(): Promise<void> {
    const now = Date.now();
    const staleAfter = this.room.stage === 'ROOM_LOBBY' ? 2 * 60 * 60_000 : this.room.stage === 'MATCH_COMPLETE' ? 24 * 60 * 60_000 : 6 * 60 * 60_000;
    if (this.room.initialized && this.ctx.getWebSockets().length === 0 && now - this.room.updatedAt >= staleAfter) {
      await this.ctx.storage.deleteAll();
      this.room = emptyState();
      return;
    }
    const host = this.room.players.find((player) => player.host);
    if (host && !host.connected && host.kind === 'human' && host.lastSeen <= now - 10_000) this.transferDisconnectedHost(host);
    this.room.players = this.room.players.filter((player) => player.connected || player.kind === 'bot' || player.reservedUntil === null || player.reservedUntil > now || player.host);
    if (this.room.timerEndsAt && this.room.timerEndsAt <= now) await this.handleTimerExpired();
    await this.persist();
    this.broadcast();
    const due = this.nextAlarmAt();
    if (due) await this.scheduleAt(due);
  }

  private async handleEvent(player: StoredPlayer, event: ClientEvent): Promise<void> {
    if (event.type === 'send_chat') {
      if (!this.rate.allow(`chat:${player.id}`, 8, 10_000)) throw new Error('Chat is moving too quickly. Try again in a moment.');
      if (!featureEnabled(this.room.featureFlags, 'chat') || !this.room.settings.discussionChat || !['DISCUSSION', 'ROOM_LOBBY'].includes(this.room.stage)) throw new Error('Chat is closed during this part of the game.');
      this.room.chat = [...this.room.chat.slice(-99), { id: event.id, playerId: player.id, playerName: player.name, text: event.text, createdAt: Date.now(), bot: player.kind === 'bot' }];
      return;
    }
    if (event.type === 'player_ready') {
      if (!['ROLE_REVEAL', 'SCOREBOARD'].includes(this.room.stage)) throw new Error('There is nothing to ready up for yet.');
      if (player.kind === 'spectator') throw new Error('Spectators do not need to ready up.');
      player.ready = event.ready;
      if (this.room.stage === 'ROLE_REVEAL' && this.readySeats().length === this.activeSeats().length) await this.beginClues();
      return;
    }
    if (event.type === 'submit_clue') {
      if (this.room.stage !== 'CLUE_TURN' || !['typed', 'emoji'].includes(this.room.settings.clueMode)) throw new Error('Clues are not being collected right now.');
      if (!this.room.turnOrder.includes(player.id)) throw new Error('Spectators cannot submit clues.');
      const compact = event.clue.trim();
      if (this.room.settings.oneWordClues && compact.split(/\s+/).length > 1) throw new Error('This round uses one-word clues.');
      if (this.room.settings.clueMode === 'emoji' && !/^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d|\ufe0f|\s)+$/u.test(compact)) throw new Error('Emoji rounds accept emoji only.');
      if (compact.length > this.room.settings.clueMaxLength) throw new Error(`Keep your clue under ${this.room.settings.clueMaxLength} characters.`);
      if (this.room.settings.forbiddenClueWords.some((word) => normalizeGuess(compact).split(' ').includes(normalizeGuess(word)))) throw new Error('That clue uses a forbidden word for this room.');
      if (player.role === 'innocent' && this.room.word && !validateBotClue(compact, this.room.word, this.room.settings.clueMaxLength)) throw new Error('That clue is too close to the secret word.');
      player.clue = compact;
      if (this.currentPlayer()?.id === player.id) player.clueRevealed = true;
      return;
    }
    if (event.type === 'submit_drawing') {
      if (!this.rate.allow(`drawing:${player.id}`, 4, 10_000)) throw new Error('Please wait before submitting another drawing.');
      if (!featureEnabled(this.room.featureFlags, 'drawing') || this.room.stage !== 'CLUE_TURN' || this.room.settings.clueMode !== 'drawing') throw new Error('Drawing clues are unavailable right now.');
      if (!this.room.turnOrder.includes(player.id)) throw new Error('Spectators cannot submit drawings.');
      player.clueDrawing = event.drawing;
      player.clue = 'Drawing clue';
      if (this.currentPlayer()?.id === player.id) player.clueRevealed = true;
      return;
    }
    if (event.type === 'update_note') {
      if (!this.room.settings.privateNotebook || player.kind === 'spectator') throw new Error('The private notebook is not enabled.');
      player.note = event.note;
      return;
    }
    if (event.type === 'submit_prediction') {
      if (!featureEnabled(this.room.featureFlags, 'spectatorPredictions') || !this.room.settings.spectatorPredictions || player.kind !== 'spectator' || !['CLUE_TURN', 'DISCUSSION', 'VOTING'].includes(this.room.stage)) throw new Error('Audience predictions are closed.');
      if (!this.activeSeats().some((seat) => seat.id === event.playerId)) throw new Error('That player is not eligible.');
      player.prediction = event.playerId;
      return;
    }
    if (event.type === 'send_reaction') {
      if (!this.room.settings.secretReactions && !(player.kind === 'spectator' && this.room.settings.audienceReactions)) throw new Error('Reactions are disabled in this room.');
      if (player.kind === 'spectator' && !featureEnabled(this.room.featureFlags, 'audience')) throw new Error('Audience participation is currently unavailable.');
      if (player.reactionsUsed.length >= 8) throw new Error('You have used all your reactions this round.');
      player.reactionsUsed.push(event.emoji);
      this.room.reactions[event.emoji] = (this.room.reactions[event.emoji] ?? 0) + 1;
      return;
    }
    if (event.type === 'submit_crowd_word') {
      if (!this.rate.allow(`crowd:${player.id}`, 4, 10_000)) throw new Error('Please wait before changing your crowd word again.');
      if (!featureEnabled(this.room.featureFlags, 'customPacks') || !this.room.settings.crowdPack || this.room.stage !== 'ROOM_LOBBY' || player.kind === 'spectator') throw new Error('Crowd pack submissions are closed.');
      const normalized = normalizeGuess(event.word).replace(/s$/, '');
      if (this.room.settings.wordBlacklist.some((word) => normalizeGuess(word).replace(/s$/, '') === normalized)) throw new Error('That word is blocked in this room.');
      if (this.room.crowdWords.some((entry) => entry.playerId !== player.id && normalizeGuess(entry.word).replace(/s$/, '') === normalized)) throw new Error('That word is already in the crowd pack.');
      this.room.crowdWords = [...this.room.crowdWords.filter((entry) => entry.playerId !== player.id), { playerId: player.id, word: event.word.trim() }].slice(-100);
      return;
    }
    if (event.type === 'finish_spoken_clue') {
      if (this.room.stage !== 'CLUE_TURN' || this.currentPlayer()?.id !== player.id) throw new Error('It is not your turn yet.');
      if (['typed', 'emoji', 'drawing'].includes(this.room.settings.clueMode) && !player.clue) throw new Error('Submit your clue first.');
      await this.advanceTurn();
      return;
    }
    if (event.type === 'submit_vote') {
      if (!['VOTING', 'REVOTE'].includes(this.room.stage)) throw new Error('Voting is not open yet.');
      if (player.kind === 'spectator') throw new Error('Spectators cannot vote.');
      if (event.playerId === player.id) throw new Error('You cannot vote for yourself.');
      if (!this.activeSeats().some((seat) => seat.id === event.playerId)) throw new Error('That player is not eligible.');
      if (player.vote) throw new Error('Your vote is already locked.');
      player.vote = event.playerId;
      player.voteConfidence = this.room.settings.confidenceVoting ? event.confidence : 2;
      if (this.activeSeats().every((seat) => seat.vote)) await this.revealVotes();
      return;
    }
    if (event.type === 'submit_mole_guess') {
      if (this.room.stage !== 'MOLE_GUESS' || this.room.settings.guessMode !== 'typed' || player.role !== 'mole' || !this.room.accusedIds.includes(player.id)) throw new Error('You do not have a typed guess to make.');
      if (player.guess) throw new Error('Your guess is already locked.');
      player.guess = event.guess;
      if (this.caughtMoles().every((mole) => mole.guess)) this.finalizeRound();
      return;
    }
    this.requireHost(player);
    switch (event.type) {
      case 'host_start': await this.startRound(); break;
      case 'host_advance': await this.hostAdvance(); break;
      case 'host_pause': await this.pauseTimer(); break;
      case 'host_resume': await this.resumeTimer(); break;
      case 'host_add_time': await this.addTime(event.seconds); break;
      case 'host_add_bot': this.addBot(event.name, event.difficulty); break;
      case 'host_quick_fill': while (this.activeSeats().length < event.targetSeats) this.addBot(); break;
      case 'host_rename_bot': this.renameBot(event.playerId, event.name); break;
      case 'host_set_bot_personality': this.setBotPersonality(event.playerId, event.personality); break;
      case 'host_remove_bot': this.removePlayer(event.playerId, true); break;
      case 'host_kick': this.removePlayer(event.playerId, false); break;
      case 'host_transfer': this.transferHost(event.playerId); break;
      case 'host_judge_guess': this.judgeSpokenGuess(event.playerId, event.correct); break;
      case 'host_restart_round': await this.startRound(true); break;
      case 'host_end_match': this.endMatch(); break;
      case 'host_rematch': this.rematch(event.mode); break;
      case 'update_settings': this.updateSettings(event.settings); break;
      default: throw new Error('That host action is not available.');
    }
  }

  private async startRound(restart = false): Promise<void> {
    if (!restart && !['ROOM_LOBBY', 'SCOREBOARD'].includes(this.room.stage)) throw new Error('The current round needs to finish first.');
    if (restart && ['ROOM_LOBBY', 'SCOREBOARD', 'MATCH_COMPLETE'].includes(this.room.stage)) throw new Error('There is no active round to restart.');
    for (const player of this.room.players) if (player.queuedForNextRound) { player.kind = 'human'; player.role = null; player.queuedForNextRound = false; }
    const seats = this.activeSeats();
    if (seats.length < 4) throw new Error('Add Bots to Start — Moley works best with at least four seats.');
    this.room.stage = 'ROUND_SETUP';
    this.room.roundNumber += restart ? 0 : 1;
    const blacklist = new Set(this.room.settings.wordBlacklist.map(normalizeGuess));
    const suppliedWords = [...this.room.settings.customWords, ...(this.room.settings.crowdPack ? this.room.crowdWords.map((entry) => entry.word) : [])];
    const custom = featureEnabled(this.room.featureFlags, 'customPacks')
      ? [...new Map(suppliedWords.filter((word) => !blacklist.has(normalizeGuess(word))).map((word) => [normalizeGuess(word).replace(/s$/, ''), word])).values()]
      : [];
    this.room.word = custom.length
      ? (() => { const display = custom[Math.floor(secureRandom() * custom.length)]!; return { id: `custom-${display.toLocaleLowerCase('en-CA')}`, display, aliases: [], category: 'Custom Pack', difficulty: 'medium' as const, tags: ['custom'], safeBotClues: ['familiar', 'something', 'recognizable'], familySafe: true, contentLevel: 'family' as const, pack: 'custom' }; })()
      : (() => {
        const selected = this.room.settings.categories.length ? new Set(this.room.settings.categories) : null;
        const recent = new Set(this.room.usedWordIds.slice(-this.room.settings.preventRecentWords));
        const pool = words.filter((word) => (!selected || selected.has(word.category)) && !recent.has(word.id) && !blacklist.has(normalizeGuess(word.display)) && (this.room.settings.wordDifficulty === 'mixed' || word.difficulty === this.room.settings.wordDifficulty) && (this.room.settings.contentLevel !== 'family' || word.familySafe));
        return pool.length ? pool[Math.floor(secureRandom() * pool.length)]! : pickWord(this.room.settings.categories, this.room.usedWordIds, secureRandom);
      })();
    this.room.usedWordIds = [...this.room.usedWordIds.slice(-Math.max(199, this.room.settings.preventRecentWords)), this.room.word.id];
    const requested = this.room.settings.moleCount ?? autoMoleCount(seats.length);
    this.room.moleIds = assignMoles(seats.map((player) => ({ id: player.id, moleRounds: player.moleRounds, kind: player.kind === 'bot' ? 'bot' : 'human' })), requested, this.room.roundNumber, secureRandom);
    this.room.turnOrder = shuffled(seats.map((player) => player.id), secureRandom);
    this.room.currentTurn = 0;
    this.room.accusedIds = [];
    this.room.votesRevealed = null;
    this.room.result = null;
    this.room.winners = [];
    this.room.message = null;
    this.room.voteRevealItems = [];
    this.room.reactions = {};
    this.room.revoteUsed = false;
    const modifiers = ['Reverse clue order', 'Lightning discussion', 'Double bluff', 'Silent first clue', 'Mystery category', 'Last player starts'];
    this.room.chaosModifier = this.room.settings.chaosMode && featureEnabled(this.room.featureFlags, 'chaos') ? modifiers[Math.floor(secureRandom() * modifiers.length)]! : null;
    if (this.room.chaosModifier === 'Reverse clue order') this.room.turnOrder.reverse();
    if (this.room.chaosModifier === 'Last player starts') this.room.turnOrder.sort((a, b) => (this.player(b)?.joinedAt ?? 0) - (this.player(a)?.joinedAt ?? 0));
    if (this.room.chaosModifier === 'Double bluff') this.room.moleIds = assignMoles(seats.map((player) => ({ id: player.id, moleRounds: player.moleRounds, kind: player.kind === 'bot' ? 'bot' : 'human' })), requested + 1, this.room.roundNumber, secureRandom);
    this.clearTimer();
    for (const player of this.room.players) {
      player.ready = player.kind === 'bot';
      player.role = player.kind === 'spectator' ? 'spectator' : this.room.moleIds.includes(player.id) ? 'mole' : 'innocent';
      if (player.role === 'mole') player.moleRounds.push(this.room.roundNumber);
      player.clue = null; player.clueDrawing = null; player.clueRevealed = false; player.clueSkipped = false; player.vote = null; player.voteConfidence = null; player.guess = null; player.guessCorrect = undefined; player.roundGain = 0; player.prediction = null; player.reactionsUsed = []; player.note = '';
      if (player.kind === 'bot') player.botMind = { candidates: [], suspicion: {} };
    }
    this.room.stage = 'ROLE_REVEAL';
    this.metric('game_started', { seats: seats.length, bots: seats.filter((seat) => seat.kind === 'bot').length, clueMode: this.room.settings.clueMode });
    if (this.readySeats().length === seats.length) await this.beginClues();
  }

  private async beginClues(): Promise<void> {
    this.room.stage = 'CLUE_PREPARATION';
    for (const bot of this.activeSeats().filter((player) => (player.kind === 'bot' || player.autopilot) && player.role === 'innocent')) {
      const fallback = innocentBotClue(this.room.word!, [], bot.difficulty ?? this.room.settings.botDifficulty, secureRandom);
      bot.clue = featureEnabled(this.room.featureFlags, 'ai') ? await this.ai.improveInnocentClue(this.room.word!, [], this.room.settings.clueMaxLength) ?? fallback : fallback;
    }
    this.room.stage = 'CLUE_TURN';
    this.room.currentTurn = 0;
    if (this.room.chaosModifier === 'Silent first clue' && this.currentPlayer()) { this.currentPlayer()!.clueSkipped = true; this.room.currentTurn = Math.min(1, this.room.turnOrder.length - 1); }
    await this.playBotsUntilHuman();
    this.startStageTimer(this.room.settings.rapidSeconds);
  }

  private async playBotsUntilHuman(): Promise<void> {
    while (this.room.stage === 'CLUE_TURN') {
      const current = this.currentPlayer();
      if (!current || (current.kind !== 'bot' && !current.autopilot)) break;
      const observed = Object.fromEntries(this.activeSeats().filter((player) => player.clueRevealed && player.clue).map((player) => [player.id, player.clue!]));
      if (current.role === 'mole') {
        const candidates = words.filter((word) => !this.room.settings.moleKnowsCategory || word.category === this.room.word?.category);
        current.botMind = updateMoleCandidates(current.botMind ?? { candidates: [], suspicion: {} }, Object.values(observed).join(' '), candidates);
        current.clue = moleBotClue(current.botMind, Object.values(observed), current.difficulty ?? 'normal', secureRandom);
      }
      current.clue = current.clue || 'familiar';
      current.clueRevealed = true;
      this.room.currentTurn += 1;
      if (this.room.currentTurn >= this.room.turnOrder.length) { this.enterDiscussion(); break; }
    }
  }

  private async advanceTurn(): Promise<void> {
    const current = this.currentPlayer();
    if (current) {
      current.clueRevealed = true;
      if (!current.clue && this.room.settings.clueMode === 'spoken') current.clue = 'Spoken clue';
    }
    this.room.currentTurn += 1;
    this.clearTimer();
    if (this.room.currentTurn >= this.room.turnOrder.length) { this.enterDiscussion(); return; }
    const next = this.currentPlayer();
    if (next?.clue) next.clueRevealed = true;
    await this.playBotsUntilHuman();
    if (this.room.stage === 'CLUE_TURN') this.startStageTimer(this.room.settings.rapidSeconds);
  }

  private enterDiscussion(): void {
    this.room.stage = 'DISCUSSION';
    this.startStageTimer(this.room.chaosModifier === 'Lightning discussion' ? Math.max(10, Math.floor(this.room.settings.discussionSeconds / 2)) : this.room.settings.discussionSeconds);
    const bots = this.activeSeats().filter((player) => player.kind === 'bot' && player.personality !== 'quiet').slice(0, Math.max(1, Math.floor(this.activeSeats().length / 8)));
    for (const bot of bots) {
      const suspect = this.activeSeats().find((player) => player.id !== bot.id && (!player.clue || player.clue === 'Spoken clue'));
      if (suspect) this.room.chat.push({ id: newId('chat'), playerId: bot.id, playerName: bot.name, text: `${suspect.name}'s clue felt pretty broad.`, createdAt: Date.now(), bot: true });
    }
  }

  private enterVoting(): void {
    this.room.stage = 'VOTING';
    this.clearTimer();
    const seats = this.activeSeats();
    const clues = Object.fromEntries(seats.filter((player) => player.clue).map((player) => [player.id, player.clue!]));
    for (const bot of seats.filter((player) => player.kind === 'bot' || player.autopilot)) {
      bot.vote = botVote(bot.id, seats.map((player) => player.id), clues, bot.role === 'mole' ? 'mole' : 'innocent', bot.role === 'innocent' ? this.room.word : null, bot.difficulty ?? 'normal', secureRandom);
    }
    this.startStageTimer(this.room.settings.votingSeconds);
    if (seats.every((player) => player.vote)) this.ctx.waitUntil(this.revealVotes());
  }

  private async revealVotes(): Promise<void> {
    this.clearTimer();
    const seats = this.activeSeats();
    const votes = Object.fromEntries(seats.filter((player) => player.vote).map((player) => [player.id, player.vote!]));
    const resolution = rankVotes(seats.map((player) => player.id), votes, this.room.moleIds.length);
    this.room.stage = 'VOTE_REVEAL';
    this.room.votesRevealed = Object.fromEntries(resolution.ranked.map((item) => [item.playerId, item.votes]));
    this.room.voteRevealItems = seats.filter((voter) => voter.vote).map((voter) => ({
      voterId: this.room.settings.voteReveal === 'anonymous' ? null : voter.id,
      targetId: voter.vote!, confidence: voter.voteConfidence ?? 2
    }));
    if (this.room.settings.voteReveal === 'incremental') this.room.voteRevealItems = shuffled(this.room.voteRevealItems, secureRandom);
    this.room.accusedIds = [...resolution.accusedIds];
    if (resolution.tiedIds.length) {
      this.room.stage = 'TIE_RESOLUTION';
      const needed = this.room.moleIds.length - this.room.accusedIds.length;
      this.room.accusedIds.push(...resolveTie(resolution.tiedIds, needed, secureRandom));
      this.room.message = resolution.tiedIds.length === 2 ? 'MOLEY COIN FLIP' : 'MOLEY TIE WHEEL';
    }
    if (this.room.settings.defenceSeconds > 0 && !this.room.revoteUsed) {
      this.room.stage = 'DEFENCE';
      this.startStageTimer(this.room.settings.defenceSeconds);
      return;
    }
    this.beginAccusation();
  }

  private beginAccusation(): void {
    this.clearTimer();
    this.room.stage = 'ACCUSATION';
    const caught = this.caughtMoles();
    if (!caught.length) { this.finalizeRound(); return; }
    this.room.stage = 'MOLE_GUESS';
    for (const mole of caught.filter((player) => player.kind === 'bot')) {
      const top = mole.botMind?.candidates[0]?.word;
      const fallback = words.find((word) => word.category === (this.room.settings.moleKnowsCategory ? this.room.word?.category : undefined))?.display;
      mole.guess = top ?? fallback ?? 'I have no idea';
    }
    if (caught.every((player) => player.guess)) this.finalizeRound();
    else this.startStageTimer(this.room.settings.guessSeconds);
  }

  private finishDefence(): void {
    if (this.room.settings.allowRevote && !this.room.revoteUsed) {
      this.room.revoteUsed = true;
      for (const player of this.activeSeats()) { player.vote = null; player.voteConfidence = null; }
      this.room.stage = 'REVOTE';
      this.startStageTimer(this.room.settings.votingSeconds);
      return;
    }
    this.beginAccusation();
  }

  private finalizeRound(): void {
    if (!this.room.word) throw new Error('The secret word went missing. Restart this round.');
    const seats = this.activeSeats();
    const result = scoreRound({
      playerIds: seats.map((player) => player.id),
      moleIds: this.room.moleIds,
      accusedIds: this.room.accusedIds,
      guesses: Object.fromEntries(this.caughtMoles().map((player) => [player.id, { guess: player.guess ?? '', correct: player.guessCorrect }])),
      word: this.room.word
    });
    for (const player of seats) { player.roundGain = result.gains[player.id] ?? 0; player.score += player.roundGain; }
    this.room.result = result;
    this.room.winners = findWinners(Object.fromEntries(seats.map((player) => [player.id, player.score])), this.room.settings);
    this.room.stage = 'ROUND_REVEAL';
    this.room.history = [...this.room.history.slice(-23), {
      roundNumber: this.room.roundNumber, word: this.room.word.display, category: this.room.word.category,
      result, clues: seats.map((player) => ({ playerId: player.id, clue: player.clue ?? undefined, anonymous: this.room.settings.anonymousClues })),
      voteTotals: this.room.votesRevealed ?? {}, createdAt: Date.now()
    }];
    this.clearTimer();
    this.metric('round_completed', { seats: seats.length, caught: result.caughtMoleIds.length, aiFallback: false });
  }

  private async hostAdvance(): Promise<void> {
    switch (this.room.stage) {
      case 'ROLE_REVEAL': await this.beginClues(); break;
      case 'CLUE_TURN': {
        const current = this.currentPlayer();
        if (current) current.clueSkipped = true;
        await this.advanceTurn(); break;
      }
      case 'DISCUSSION': this.enterVoting(); break;
      case 'VOTING': await this.revealVotes(); break;
      case 'REVOTE': await this.revealVotes(); break;
      case 'DEFENCE': this.finishDefence(); break;
      case 'MOLE_GUESS': this.finalizeRound(); break;
      case 'ROUND_REVEAL': this.room.stage = 'ROUND_RECAP'; break;
      case 'ROUND_RECAP': this.room.stage = this.room.winners.length ? 'MATCH_COMPLETE' : 'SCOREBOARD'; break;
      case 'SCOREBOARD': await this.startRound(); break;
      default: throw new Error('There is nothing to advance from this screen.');
    }
  }

  private async handleTimerExpired(): Promise<void> {
    this.clearTimer();
    if (this.room.stage === 'CLUE_TURN') {
      const current = this.currentPlayer(); if (current) current.clueSkipped = true;
      await this.advanceTurn();
    } else if (this.room.stage === 'DISCUSSION') this.enterVoting();
    else if (this.room.stage === 'VOTING') await this.revealVotes();
    else if (this.room.stage === 'REVOTE') await this.revealVotes();
    else if (this.room.stage === 'DEFENCE') this.finishDefence();
    else if (this.room.stage === 'MOLE_GUESS') this.finalizeRound();
  }

  private addBot(requestedName?: string, difficulty?: 'easy' | 'normal' | 'sneaky'): void {
    if (this.room.stage !== 'ROOM_LOBBY') throw new Error('Bots can be added between matches.');
    const names = ['Milo', 'Dot', 'Biscuit', 'Pepper', 'Noodle', 'Archie', 'Waffles', 'Pip', 'Juniper', 'Scout'];
    const name = requestedName?.trim() || names.find((candidate) => !this.room.players.some((player) => normalizeName(player.name) === normalizeName(candidate))) || `Bot ${this.room.players.filter((player) => player.kind === 'bot').length + 1}`;
    const checked = validateName(name, this.room.players);
    if (!checked.ok) throw new Error(checked.error);
    const now = Date.now();
    this.room.players.push({
      id: newId('bot'), name: checked.name, kind: 'bot', reconnectToken: '', score: 0, roundGain: 0,
      host: false, connected: true, joinedAt: now, lastSeen: now, reservedUntil: null, ready: true,
      role: null, moleRounds: [], clue: null, clueRevealed: false, clueSkipped: false, vote: null,
      guess: null, difficulty: difficulty ?? this.room.settings.botDifficulty, personality: randomPersonality(secureRandom),
      botMind: { candidates: [], suspicion: {} }, clueDrawing: null, note: '', voteConfidence: null,
      prediction: null, reactionsUsed: [], afk: false, autopilot: false
    });
  }

  private renameBot(playerId: string, name: string): void {
    if (this.room.stage !== 'ROOM_LOBBY') throw new Error('Bots can be renamed in the lobby.');
    const bot = this.player(playerId);
    if (!bot || bot.kind !== 'bot') throw new Error('That seat is not a bot.');
    const checked = validateName(name, this.room.players.filter((player) => player.id !== bot.id));
    if (!checked.ok) throw new Error(checked.error);
    bot.name = checked.name;
  }

  private setBotPersonality(playerId: string, personality: NonNullable<StoredPlayer['personality']>): void {
    if (this.room.stage !== 'ROOM_LOBBY') throw new Error('Bot personalities can be changed in the lobby.');
    const bot = this.player(playerId);
    if (!bot || bot.kind !== 'bot') throw new Error('That seat is not a bot.');
    bot.personality = personality;
  }

  private removePlayer(playerId: string, botsOnly: boolean): void {
    if (!['ROOM_LOBBY', 'SCOREBOARD', 'MATCH_COMPLETE'].includes(this.room.stage)) throw new Error('Seats can only be removed between rounds.');
    const target = this.player(playerId);
    if (!target || target.host) throw new Error('That player cannot be removed.');
    if (botsOnly && target.kind !== 'bot') throw new Error('That seat is not a bot.');
    this.room.players = this.room.players.filter((player) => player.id !== playerId);
    this.room.turnOrder = this.room.turnOrder.filter((id) => id !== playerId);
    this.room.accusedIds = this.room.accusedIds.filter((id) => id !== playerId);
    if (this.room.currentTurn >= this.room.turnOrder.length) this.room.currentTurn = Math.max(0, this.room.turnOrder.length - 1);
  }

  private transferHost(playerId: string): void {
    const target = this.player(playerId);
    if (!target || target.kind !== 'human' || !target.connected) throw new Error('Choose a connected human player as host.');
    for (const player of this.room.players) player.host = player.id === target.id;
    this.room.message = `${target.name} is now the host`;
  }

  private judgeSpokenGuess(playerId: string, correct: boolean): void {
    if (this.room.stage !== 'MOLE_GUESS' || this.room.settings.guessMode !== 'spoken') throw new Error('There is no spoken guess to judge.');
    const mole = this.player(playerId);
    if (!mole || mole.role !== 'mole' || !this.room.accusedIds.includes(playerId)) throw new Error('That player does not have a Mole guess.');
    mole.guess = 'Spoken answer';
    mole.guessCorrect = correct;
    if (this.caughtMoles().every((player) => player.guess)) this.finalizeRound();
  }

  private transferDisconnectedHost(former: StoredPlayer): void {
    const target = this.room.players.filter((player) => player.kind === 'human' && player.connected && player.id !== former.id).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (target) this.transferHost(target.id);
  }

  private ensureHostPresence(): void {
    const host = this.room.players.find((player) => player.host && player.kind === 'human');
    if (!host) return;
    const hasLiveSocket = this.ctx.getWebSockets(host.id).some((socket) => socket.readyState === WebSocket.OPEN);
    if (!hasLiveSocket && host.lastSeen <= Date.now() - 10_000) {
      host.connected = false;
      this.transferDisconnectedHost(host);
    }
  }

  private endMatch(): void {
    this.room.winners = this.activeSeats().sort((a, b) => b.score - a.score).filter((player, _, players) => player.score === players[0]?.score).map((player) => player.id);
    this.room.stage = 'MATCH_COMPLETE'; this.clearTimer();
  }

  private rematch(mode: 'same' | 'reset' | 'settings'): void {
    if (this.room.stage !== 'MATCH_COMPLETE') throw new Error('Finish this match before starting a rematch.');
    for (const player of this.room.players) { if (mode !== 'same') player.score = 0; player.roundGain = 0; player.moleRounds = []; player.role = player.kind === 'spectator' ? 'spectator' : null; }
    this.room.stage = 'ROOM_LOBBY'; this.room.roundNumber = 0; this.room.result = null; this.room.winners = []; this.room.message = null;
    if (mode === 'settings') this.room.settings = { ...this.room.settings, preset: 'custom' };
  }

  private updateSettings(input: Partial<ReturnType<typeof settingsSchema.parse>>): void {
    if (!['ROOM_LOBBY', 'SCOREBOARD'].includes(this.room.stage)) throw new Error('Settings can be changed between rounds.');
    const parsed = settingsSchema.safeParse({ ...this.room.settings, ...input });
    if (!parsed.success) throw new Error('One of those settings needs another look.');
    const seats = this.activeSeats().length;
    if (parsed.data.moleCount !== null && parsed.data.moleCount >= Math.ceil(Math.max(4, seats) / 2)) throw new Error('Moles need an innocent majority. Choose fewer Moles.');
    if (!featureEnabled(this.room.featureFlags, 'drawing') && parsed.data.clueMode === 'drawing') throw new Error('Drawing clues are currently unavailable.');
    if (!featureEnabled(this.room.featureFlags, 'customPacks') && parsed.data.customWords.length) throw new Error('Custom packs are currently unavailable.');
    if (!featureEnabled(this.room.featureFlags, 'spectatorPredictions') && parsed.data.spectatorPredictions) throw new Error('Spectator predictions are currently unavailable.');
    if (!featureEnabled(this.room.featureFlags, 'chat')) parsed.data.discussionChat = false;
    if (!featureEnabled(this.room.featureFlags, 'chaos')) parsed.data.chaosMode = false;
    if (!featureEnabled(this.room.featureFlags, 'cosmetics')) parsed.data.roomTheme = 'classic';
    this.room.settings = parsed.data;
  }

  private async pauseTimer(): Promise<void> {
    if (!this.room.timerEndsAt) throw new Error('There is no running timer.');
    this.room.timerPausedRemaining = Math.max(0, this.room.timerEndsAt - Date.now());
    this.room.timerEndsAt = null;
  }

  private async resumeTimer(): Promise<void> {
    if (this.room.timerPausedRemaining === null) throw new Error('The timer is not paused.');
    this.room.timerEndsAt = Date.now() + this.room.timerPausedRemaining;
    this.room.timerPausedRemaining = null;
    await this.scheduleAt(this.room.timerEndsAt);
  }

  private async addTime(seconds: number): Promise<void> {
    if (this.room.timerEndsAt) { this.room.timerEndsAt += seconds * 1000; await this.scheduleAt(this.room.timerEndsAt); }
    else if (this.room.timerPausedRemaining !== null) this.room.timerPausedRemaining += seconds * 1000;
    else throw new Error('There is no timer to extend.');
  }

  private startStageTimer(seconds: number): void {
    this.clearTimer();
    if (seconds <= 0) return;
    this.room.timerEndsAt = Date.now() + seconds * 1000;
    this.ctx.waitUntil(this.scheduleAt(this.room.timerEndsAt));
  }

  private clearTimer(): void { this.room.timerEndsAt = null; this.room.timerPausedRemaining = null; }

  private requireHost(player: StoredPlayer): void { if (!player.host || player.kind !== 'human') throw new Error('Only the current host can do that.'); }
  private player(id: string): StoredPlayer | undefined { return this.room.players.find((player) => player.id === id); }
  private activeSeats(): StoredPlayer[] { return this.room.players.filter((player) => player.kind !== 'spectator'); }
  private readySeats(): StoredPlayer[] { return this.activeSeats().filter((player) => player.ready || !player.connected); }
  private caughtMoles(): StoredPlayer[] { return this.room.players.filter((player) => player.role === 'mole' && this.room.accusedIds.includes(player.id)); }
  private currentPlayer(): StoredPlayer | undefined { return this.player(this.room.turnOrder[this.room.currentTurn] ?? ''); }

  private publicState(): PublicRoomState {
    const hideIndividualReady = this.room.stage === 'ROLE_REVEAL';
    const revealStages = ['ROUND_REVEAL', 'ROUND_RECAP', 'SCOREBOARD', 'MATCH_COMPLETE'];
    const clueVisible = (player: StoredPlayer) => player.clueRevealed || revealStages.includes(this.room.stage);
    const predictions = this.room.players.filter((player) => player.kind === 'spectator' && player.prediction).reduce<Record<string, number>>((totals, player) => { totals[player.prediction!] = (totals[player.prediction!] ?? 0) + 1; return totals; }, {});
    const publicVoteStages = ['VOTE_REVEAL', 'TIE_RESOLUTION', 'DEFENCE', 'REVOTE', 'ACCUSATION', 'MOLE_GUESS', ...revealStages];
    return {
      code: this.room.code,
      stage: this.room.stage,
      roundNumber: this.room.roundNumber,
      players: this.room.players.map((player) => ({
        id: player.id, name: player.name, kind: player.kind, score: player.score, roundGain: player.roundGain,
        host: player.host, connected: player.connected, ready: hideIndividualReady ? false : player.ready,
        joinedAt: player.joinedAt,
        clue: clueVisible(player) && !this.room.settings.anonymousClues ? player.clue ?? undefined : undefined,
        clueDrawing: clueVisible(player) && !this.room.settings.anonymousClues ? player.clueDrawing ?? undefined : undefined,
        clueStatus: player.clueSkipped ? 'skipped' : player.clueRevealed ? 'revealed' : player.clue ? 'submitted' : 'waiting'
        ,symbol: ['●', '▲', '■', '◆', '★', '✚', '⬟', '☀'][this.room.players.indexOf(player) % 8]
        ,afk: player.afk, autopilot: player.autopilot, personality: player.kind === 'bot' ? player.personality : undefined
      })),
      settings: publicSettings(this.room.settings),
      turnOrder: this.room.turnOrder,
      currentTurn: this.room.currentTurn,
      readyCount: this.readySeats().length,
      eligibleReadyCount: this.activeSeats().length,
      voteCount: this.activeSeats().filter((player) => player.vote).length,
      eligibleVoteCount: this.activeSeats().length,
      accusedIds: ['DEFENCE', 'REVOTE', 'ACCUSATION', 'MOLE_GUESS', ...revealStages].includes(this.room.stage) ? this.room.accusedIds : [],
      chat: featureEnabled(this.room.featureFlags, 'chat') && this.room.settings.discussionChat ? this.room.chat.slice(-100) : [],
      timerEndsAt: this.room.timerEndsAt,
      timerPausedRemaining: this.room.timerPausedRemaining,
      category: this.room.stage === 'ROOM_LOBBY' || (this.room.chaosModifier === 'Mystery category' && !revealStages.includes(this.room.stage)) ? null : (this.room.settings.moleKnowsCategory || revealStages.includes(this.room.stage) ? this.room.word?.category ?? null : null),
      revealedWord: revealStages.includes(this.room.stage) ? this.room.word?.display ?? null : null,
      result: revealStages.includes(this.room.stage) ? this.room.result : null,
      winners: this.room.stage === 'MATCH_COMPLETE' ? this.room.winners : [],
      message: this.room.message,
      featureFlags: this.room.featureFlags,
      appVersion: APP_VERSION,
      protocolRange: { min: MIN_PROTOCOL_VERSION, max: MAX_PROTOCOL_VERSION },
      voteRevealItems: publicVoteStages.includes(this.room.stage) ? this.room.voteRevealItems : [],
      reactions: revealStages.includes(this.room.stage) ? this.room.reactions : {},
      predictionTotals: revealStages.includes(this.room.stage) ? predictions : {},
      history: this.room.history,
      chaosModifier: this.room.chaosModifier,
      anonymousClues: this.room.settings.anonymousClues ? this.room.turnOrder.flatMap((id, index) => {
        const cluePlayer = this.player(id);
        return cluePlayer && clueVisible(cluePlayer) && (cluePlayer.clue || cluePlayer.clueDrawing) ? [{ id: `clue-${index + 1}`, clue: cluePlayer.clue ?? undefined, drawing: cluePlayer.clueDrawing ?? undefined }] : [];
      }) : [],
      crowdWordCount: this.room.crowdWords.length
    };
  }

  private privateState(player: StoredPlayer): PrivateState {
    const secretVisible = ['ROLE_REVEAL', 'CLUE_PREPARATION', 'CLUE_TURN', 'DISCUSSION', 'VOTING', 'VOTE_REVEAL', 'TIE_RESOLUTION', 'DEFENCE', 'REVOTE', 'ACCUSATION', 'MOLE_GUESS'].includes(this.room.stage);
    return {
      playerId: player.id,
      role: secretVisible ? player.role : player.kind === 'spectator' ? 'spectator' : null,
      secretWord: secretVisible && player.role === 'innocent' ? this.room.word?.display ?? null : null,
      fellowMoleIds: secretVisible && player.role === 'mole' && !this.room.settings.blindMoles ? this.room.moleIds.filter((id) => id !== player.id) : [],
      sessionToken: player.reconnectToken,
      canHost: player.host,
      submittedVote: player.vote,
      submittedClue: player.clue,
      mustGuess: this.room.stage === 'MOLE_GUESS' && player.role === 'mole' && this.room.accusedIds.includes(player.id) && !player.guess,
      judgeMoleIds: this.room.stage === 'MOLE_GUESS' && player.host && this.room.settings.guessMode === 'spoken' ? this.caughtMoles().filter((mole) => !mole.guess).map((mole) => mole.id) : []
      ,note: player.note
      ,voteConfidence: player.voteConfidence
      ,prediction: player.prediction
      ,reactionsUsed: player.reactionsUsed
      ,crowdWords: this.room.crowdWords.filter((entry) => entry.playerId === player.id).map((entry) => entry.word)
      ,forbiddenClueWords: secretVisible && player.role === 'innocent' ? this.room.settings.forbiddenClueWords : []
      ,hostSettings: player.host && ['ROOM_LOBBY', 'SCOREBOARD'].includes(this.room.stage) ? this.room.settings : null
    };
  }

  private snapshot(player: StoredPlayer): ServerEnvelope {
    return { v: PROTOCOL_VERSION, id: newId('event'), seq: ++this.room.serverSequence, ts: Date.now(), type: 'room_snapshot', public: this.publicState(), private: this.privateState(player) };
  }

  private send(socket: WebSocket, player: StoredPlayer): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(this.snapshot(player)));
  }

  private error(socket: WebSocket, message: string): void {
    const envelope: ServerEnvelope = { v: PROTOCOL_VERSION, id: newId('event'), seq: ++this.room.serverSequence, ts: Date.now(), type: 'error', message };
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(envelope));
  }

  private broadcast(message?: string): void {
    if (message) this.room.message = message;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      const player = attachment ? this.player(attachment.playerId) : null;
      if (player) this.send(socket, player);
    }
  }

  private async persist(): Promise<void> {
    this.room.updatedAt = Date.now();
    this.ctx.storage.sql.exec('INSERT INTO room_state (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at', JSON.stringify(this.room), this.room.updatedAt);
    const staleAfter = this.room.stage === 'ROOM_LOBBY' ? 2 * 60 * 60_000 : this.room.stage === 'MATCH_COMPLETE' ? 24 * 60 * 60_000 : 6 * 60 * 60_000;
    await this.scheduleAt(this.room.updatedAt + staleAfter);
  }

  private async scheduleAt(time: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || time < current) await this.ctx.storage.setAlarm(time);
  }

  private nextAlarmAt(): number | null {
    const times = [this.room.timerEndsAt, ...this.room.players.filter((player) => !player.connected && player.reservedUntil).map((player) => player.host ? player.lastSeen + 10_000 : player.reservedUntil)].filter((value): value is number => typeof value === 'number' && value > Date.now());
    return times.length ? Math.min(...times) : null;
  }

  private metric(event: string, details: Record<string, unknown>): void {
    console.log(JSON.stringify({ event, roomAgeMs: Date.now() - this.room.createdAt, ...details }));
  }
}

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0]! / 0x100000000;
}
