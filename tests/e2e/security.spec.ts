import { expect, test, type APIRequestContext } from '@playwright/test';
import { APP_VERSION, PROTOCOL_VERSION, type ServerEnvelope } from '@moley/shared';
import WebSocket from 'ws';

type Session = { code: string; playerId: string; sessionToken: string };

async function create(request: APIRequestContext, name: string, settings: Record<string, unknown> = { preset: 'custom', clueMode: 'typed', customWords: ['TOPSECRET'], targetScore: 3 }): Promise<Session> {
  const response = await request.post('/api/rooms', {
    data: { name, settings }
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<Session>;
}

async function join(request: APIRequestContext, code: string, name: string, spectator = false, display = false): Promise<Session> {
  const response = await request.post(`/api/rooms/${code}/join`, { data: { name, spectator, display } });
  expect(response.status()).toBe(201);
  return response.json() as Promise<Session>;
}

class LiveClient {
  readonly events: ServerEnvelope[] = [];
  private seq = 0;
  private constructor(private socket: WebSocket) {
    socket.on('message', (message) => this.events.push(JSON.parse(String(message)) as ServerEnvelope));
  }

  static async open(baseURL: string, session: Session): Promise<LiveClient> {
    const url = `${baseURL.replace(/^http/, 'ws')}/api/rooms/${session.code}/connect?clientVersion=${APP_VERSION}&protocol=${PROTOCOL_VERSION}`;
    const socket = new WebSocket(url, [`moley.v${PROTOCOL_VERSION}`, `session.${session.sessionToken}`], { origin: new URL(baseURL).origin });
    const client = new LiveClient(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', (error) => reject(new Error(`WebSocket failed to open: ${error.message}`)));
    });
    await client.waitFor((event) => event.type === 'room_snapshot');
    return client;
  }

  send(type: string, fields: Record<string, unknown> = {}, seq = ++this.seq): void {
    this.seq = Math.max(this.seq, seq);
    this.socket.send(JSON.stringify({ v: PROTOCOL_VERSION, id: crypto.randomUUID(), seq, type, ...fields }));
  }

  sendRaw(value: unknown): void { this.socket.send(JSON.stringify(value)); }

  async waitFor(predicate: (event: ServerEnvelope) => boolean, timeout = 8_000): Promise<ServerEnvelope> {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = this.events.find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Timed out waiting for live event');
  }

  async waitForNew(predicate: (event: ServerEnvelope) => boolean, after = this.events.length, timeout = 8_000): Promise<ServerEnvelope> {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = this.events.slice(after).find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Timed out waiting for a new live event');
  }

  latestSnapshot(): ServerEnvelope | undefined {
    return this.events.findLast((event) => event.type === 'room_snapshot');
  }

  close(): void { this.socket.close(); }
}

async function openClients(baseURL: string, sessions: Session[]): Promise<LiveClient[]> {
  const clients: LiveClient[] = [];
  for (const session of sessions) clients.push(await LiveClient.open(baseURL, session));
  return clients;
}

test('server blocks host escalation, stale events, and custom-word projection leaks', async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Protocol security scenario only needs one browser project.');
  const hostSession = await create(request, 'Host');
  const playerSessions = await Promise.all(['Alex', 'Sam', 'Riley'].map((name) => join(request, hostSession.code, name)));
  const spectatorSession = await join(request, hostSession.code, 'Audience', true);
  const displaySession = await join(request, hostSession.code, 'Public TV', true, true);
  const sessions = [hostSession, ...playerSessions, spectatorSession, displaySession];
  const clients = await openClients(baseURL!, sessions);
  const [host, player, second, third, spectator, display] = clients;

  expect(display!.latestSnapshot()?.private).toMatchObject({ role: 'spectator', secretWord: null, sessionToken: '', canHost: false, hostSettings: null });
  expect(display!.latestSnapshot()?.public?.players.some((candidate) => candidate.id === displaySession.playerId || candidate.name === 'Public TV')).toBe(false);
  display!.send('send_chat', { text: 'A TV must not chat' });
  await display!.waitFor((event) => event.type === 'error' && /read-only/.test(event.message ?? ''));

  player!.send('host_add_bot');
  const unauthorized = await player!.waitFor((event) => event.type === 'error' && /Only the current host/.test(event.message ?? ''));
  expect(unauthorized.type).toBe('error');

  player!.send('heartbeat', {}, 50);
  await player!.waitFor((event) => event.type === 'pong');
  player!.send('heartbeat', {}, 49);
  await player!.waitFor((event) => event.type === 'error' && /stale or duplicated/.test(event.message ?? ''));

  player!.send('send_chat', { text: 'x'.repeat(281) });
  await player!.waitFor((event) => event.type === 'error' && /not valid/.test(event.message ?? ''));
  player!.send('submit_drawing', { drawing: { strokes: [{ color: 'ink', width: 0.012, points: [[0.1, 0.1], [0.2, 0.2]] }] } });
  await player!.waitFor((event) => event.type === 'error' && /unavailable/.test(event.message ?? ''));

  host!.send('host_start');
  for (const client of clients) await client.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'ROLE_REVEAL');
  for (const client of [host, player, second, third]) client!.send('player_ready', { ready: true });
  for (const client of clients) await client.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'CLUE_TURN');

  const earlyTarget = host!.latestSnapshot()!.public!.players.find((candidate) => candidate.id !== playerSessions[0]!.playerId && candidate.kind !== 'spectator')!;
  player!.send('submit_vote', { playerId: earlyTarget.id });
  await player!.waitFor((event) => event.type === 'error' && /Voting is not open yet/.test(event.message ?? ''));
  player!.send('submit_mole_guess', { guess: 'TOPSECRET' });
  await player!.waitFor((event) => event.type === 'error' && /do not have a typed guess/.test(event.message ?? ''));

  const snapshots = clients.map((client) => client.latestSnapshot()!);
  const mole = snapshots.find((snapshot) => snapshot.private?.role === 'mole');
  const innocent = snapshots.find((snapshot) => snapshot.private?.role === 'innocent');
  expect(mole?.private?.secretWord).toBeNull();
  expect(JSON.stringify(mole)).not.toContain('TOPSECRET');
  expect(innocent?.private?.secretWord).toBe('TOPSECRET');
  expect(spectator!.latestSnapshot()?.private?.secretWord).toBeNull();
  expect(JSON.stringify(spectator!.latestSnapshot())).not.toContain('TOPSECRET');
  expect(display!.latestSnapshot()?.private?.secretWord).toBeNull();
  expect(JSON.stringify(display!.latestSnapshot())).not.toContain('TOPSECRET');
  expect(JSON.stringify(display!.latestSnapshot())).not.toContain(displaySession.sessionToken);
  for (const snapshot of snapshots) expect(snapshot.public?.settings.customWords).toEqual([]);

  const gameRoundOrder = host!.latestSnapshot()!.public!.turnOrder;
  const clueRoundsSeen = new Set<number>();
  while (host!.latestSnapshot()?.public?.stage === 'CLUE_TURN') {
    clueRoundsSeen.add(host!.latestSnapshot()!.public!.currentClueRound);
    expect(host!.latestSnapshot()!.public!.turnOrder).toEqual(gameRoundOrder);
    const after = host!.events.length;
    host!.send('host_advance');
    await host!.waitForNew((event) => event.type === 'room_snapshot', after);
  }
  expect([...clueRoundsSeen]).toEqual([1, 2]);
  expect(host!.latestSnapshot()?.public?.completedClueRounds).toBe(2);
  expect(host!.latestSnapshot()?.public?.stage).toBe('DISCUSSION');
  let after = host!.events.length;
  host!.send('host_advance');
  await host!.waitForNew((event) => event.type === 'room_snapshot' && event.public?.stage === 'VOTING', after);
  const seatClients = [host!, player!, second!, third!];
  const moleClient = seatClients.find((client) => client.latestSnapshot()?.private?.role === 'mole')!;
  const moleId = moleClient.latestSnapshot()!.private!.playerId;
  const playerId = player!.latestSnapshot()!.private!.playerId;
  const target = player!.latestSnapshot()!.public!.players.find((candidate) => candidate.kind !== 'spectator' && candidate.id === (playerId === moleId
    ? player!.latestSnapshot()!.public!.players.find((seat) => seat.kind !== 'spectator' && seat.id !== playerId)!.id
    : moleId))!;
  after = player!.events.length;
  player!.send('submit_vote', { playerId: target.id });
  await player!.waitForNew((event) => event.type === 'room_snapshot' && event.private?.submittedVote === target.id, after);
  player!.send('submit_vote', { playerId: target.id });
  await player!.waitFor((event) => event.type === 'error' && /already locked/.test(event.message ?? ''));

  for (const client of seatClients.filter((candidate) => candidate !== player)) {
    const selfId = client.latestSnapshot()!.private!.playerId;
    const voteTarget = selfId === moleId
      ? client.latestSnapshot()!.public!.players.find((candidate) => candidate.kind !== 'spectator' && candidate.id !== selfId)!.id
      : moleId;
    client.send('submit_vote', { playerId: voteTarget });
  }
  const guessing = await host!.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'MOLE_GUESS');
  expect(guessing.public?.revealedWord).toBeNull();
  expect(guessing.public?.result).toBeNull();
  expect(JSON.stringify(display!.latestSnapshot())).not.toContain('TOPSECRET');
  const privateGuess = await moleClient.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'MOLE_GUESS');
  expect(privateGuess.private?.mustGuess).toBe(true);
  moleClient.send('submit_mole_guess', { guess: 'definitely wrong' });
  const reveal = await host!.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'ROUND_REVEAL');
  expect(reveal.public?.revealedWord).toBe('TOPSECRET');
  expect(reveal.public?.result?.moleGuesses[moleId]).toBe('definitely wrong');
  expect(reveal.public?.result?.gains[moleId]).toBe(0);
  for (const innocent of reveal.public!.players.filter((candidate) => candidate.kind !== 'spectator' && candidate.id !== moleId)) {
    expect(reveal.public?.result?.gains[innocent.id]).toBe(2);
  }

  clients.forEach((client) => client.close());
});

test('HTTP boundary rejects cross-site, non-JSON, malformed, oversized, and enumerable status probes', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'HTTP security scenario only needs one browser project.');
  const crossSite = await request.post('/api/rooms', {
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    data: { name: 'Attacker' }
  });
  expect(crossSite.status()).toBe(403);

  const plain = await request.post('/api/rooms', { headers: { 'Content-Type': 'text/plain' }, data: '{"name":"Plain"}' });
  expect(plain.status()).toBe(415);

  const malformed = await request.post('/api/rooms', { headers: { 'Content-Type': 'application/json' }, data: '{"name":' });
  expect(malformed.status()).toBe(400);

  const oversized = await request.post('/api/rooms', { headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ name: 'Large', padding: 'x'.repeat(100_001) }) });
  expect(oversized.status()).toBe(413);

  const probe = await request.get('/api/rooms/amberbadgeracornbay');
  expect(probe.status()).toBe(405);
  expect(await probe.json()).toEqual({ error: 'Join the room to check an invitation.' });
});

test('invalid reconnect credentials cannot open a room socket', async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Protocol security scenario only needs one browser project.');
  const session = await create(request, 'Token Host');
  const url = `${baseURL!.replace(/^http/, 'ws')}/api/rooms/${session.code}/connect?clientVersion=${APP_VERSION}&protocol=${PROTOCOL_VERSION}`;
  const socket = new WebSocket(url, [`moley.v${PROTOCOL_VERSION}`, `session.${'x'.repeat(43)}`], { origin: new URL(baseURL!).origin });
  const result = await new Promise<'open' | 'rejected'>((resolve) => {
    socket.once('open', () => resolve('open'));
    socket.once('error', () => resolve('rejected'));
    socket.once('close', () => resolve('rejected'));
  });
  expect(result).toBe('rejected');
  socket.close();
});

test('protocol 2, 3, 5, missing, invalid, and forged envelopes fail closed', async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Protocol compatibility matrix runs once against the authoritative Worker.');
  const session = await create(request, 'Compatibility Host');
  const origin = new URL(baseURL!).origin;
  const rejectHandshake = async (protocol: string | null) => {
    const query = new URLSearchParams({ clientVersion: protocol === null ? '' : protocol === '3' ? '2.7.0' : APP_VERSION });
    if (protocol !== null) query.set('protocol', protocol);
    const url = `${baseURL!.replace(/^http/, 'ws')}/api/rooms/${session.code}/connect?${query}`;
    const socket = new WebSocket(url, [`moley.v${PROTOCOL_VERSION}`, `session.${session.sessionToken}`], { origin });
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      socket.once('open', () => reject(new Error(`Protocol ${String(protocol)} unexpectedly connected.`)));
      socket.once('unexpected-response', (_request, response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      });
      socket.once('error', () => { /* unexpected-response carries the authoritative HTTP result */ });
    });
  };

  for (const protocol of ['2', '3', '5', 'invalid', null]) {
    const rejection = await rejectHandshake(protocol);
    expect(rejection.status).toBe(426);
    expect(rejection.body).toMatch(/refresh|Client version is required/i);
  }

  const current = await LiveClient.open(baseURL!, session);
  const after = current.events.length;
  current.sendRaw({ v: 3, id: crypto.randomUUID(), seq: 1, type: 'heartbeat' });
  await current.waitForNew((event) => event.type === 'error' && /not valid/.test(event.message ?? ''), after);
  expect(current.latestSnapshot()?.public?.stage).toBe('ROOM_LOBBY');
  current.close();
});

test('audience actions remain private and role-scoped before round reveal', async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Protocol audience scenario only needs one browser project.');
  const hostSession = await create(request, 'Audience Host', {
    preset: 'custom', clueMode: 'spoken', boardEnabled: true, boardSize: 5,
    spectatorPredictions: true, audienceReactions: true, discussionSeconds: 0, votingSeconds: 0
  });
  const playerSessions = await Promise.all(['Avery', 'Blair', 'Casey'].map((name) => join(request, hostSession.code, name)));
  const spectatorSession = await join(request, hostSession.code, 'Audience Member', true);
  const [host, first, second, third, spectator] = await openClients(baseURL!, [hostSession, ...playerSessions, spectatorSession]);

  host!.send('host_start');
  for (const client of [host, first, second, third, spectator]) await client!.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'ROLE_REVEAL');
  for (const client of [host, first, second, third]) client!.send('player_ready', { ready: true });
  for (const client of [host, first, second, third, spectator]) await client!.waitFor((event) => event.type === 'room_snapshot' && event.public?.stage === 'CLUE_TURN');

  const targetId = host!.latestSnapshot()!.public!.players.find((player) => player.kind !== 'spectator' && player.id !== spectatorSession.playerId)!.id;
  let after = spectator!.events.length;
  spectator!.send('submit_prediction', { playerId: targetId });
  await spectator!.waitForNew((event) => event.type === 'room_snapshot' && event.private?.prediction === targetId, after);
  after = spectator!.events.length;
  spectator!.send('send_reaction', { emoji: '🤔' });
  const privateAudience = await spectator!.waitForNew((event) => event.type === 'room_snapshot' && event.private?.reactionsUsed.includes('🤔'), after);
  expect(privateAudience.public?.predictionTotals).toEqual({});
  expect(privateAudience.public?.reactions).toEqual({});
  expect(first!.latestSnapshot()?.public?.predictionTotals).toEqual({});
  expect(first!.latestSnapshot()?.public?.reactions).toEqual({});

  first!.send('submit_prediction', { playerId: targetId });
  await first!.waitFor((event) => event.type === 'error' && /predictions are closed/.test(event.message ?? ''));
  [host, first, second, third, spectator].forEach((client) => client!.close());
});
