const base = process.env.MOLEY_LOAD_URL ?? 'http://127.0.0.1:8787';
const seats = Number(process.env.MOLEY_LOAD_SEATS ?? 100);
const spectators = Number(process.env.MOLEY_LOAD_SPECTATORS ?? 0);
const rooms = Number(process.env.MOLEY_LOAD_ROOMS ?? 1);
const scenario = process.env.MOLEY_LOAD_SCENARIO ?? 'fanout';

type Session = { code: string; playerId: string; sessionToken: string };

async function json<T>(response: Response | Promise<Response>): Promise<T> {
  const resolved = await response;
  const body = await resolved.json() as T & { error?: string };
  if (!resolved.ok) throw new Error(body.error ?? `HTTP ${resolved.status}`);
  return body;
}

async function createRoom(roomIndex: number): Promise<Session> {
  return json(fetch(`${base}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Host ${roomIndex}`, settings: { clueMode: 'typed' } }) }));
}

async function join(code: string, name: string, spectator = false): Promise<Session> {
  return json(fetch(`${base}/api/rooms/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, spectator }) }));
}

async function runRoom(index: number) {
  const started = performance.now();
  const host = await createRoom(index);
  const sessions: Session[] = [host];
  for (let offset = 1; offset < seats; offset += 25) {
    const batch = Array.from({ length: Math.min(25, seats - offset) }, (_, item) => join(host.code, `Load ${index}-${offset + item}`));
    sessions.push(...await Promise.all(batch));
    if (offset + 25 < seats) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  for (let offset = 0; offset < spectators; offset += 25) {
    const batch = Array.from({ length: Math.min(25, spectators - offset) }, (_, item) => join(host.code, `Audience ${index}-${offset + item}`, true));
    sessions.push(...await Promise.all(batch));
  }
  const sockets = sessions.map((session) => new WebSocket(`${base.replace(/^http/, 'ws')}/api/rooms/${session.code}/connect?clientVersion=${APP_VERSION}&protocol=${PROTOCOL_VERSION}`, [`moley.v${PROTOCOL_VERSION}`, `session.${session.sessionToken}`]));
  await Promise.all(sockets.map((socket) => new Promise<void>((resolve, reject) => { socket.addEventListener('open', () => resolve(), { once: true }); socket.addEventListener('error', () => reject(new Error('socket failed')), { once: true }); })));
  const connectedMs = performance.now() - started;
  const sequences = sockets.map(() => 0);
  const send = (socketIndex: number, event: Record<string, unknown>) => sockets[socketIndex]!.send(JSON.stringify({ ...event, v: PROTOCOL_VERSION, id: crypto.randomUUID(), seq: ++sequences[socketIndex]! }));
  const pongLatencies: number[] = [];
  const heartbeatStarted = performance.now();
  for (const socket of sockets) socket.addEventListener('message', (message) => {
    try { if ((JSON.parse(String(message.data)) as { type?: string }).type === 'pong') pongLatencies.push(performance.now() - heartbeatStarted); } catch { /* Counted as a missing pong below. */ }
  });
  for (const [socketIndex] of sockets.entries()) send(socketIndex, { type: 'heartbeat' });
  while (pongLatencies.length < sockets.length && performance.now() - heartbeatStarted < 5_000) await new Promise((resolve) => setTimeout(resolve, 20));
  if (scenario === 'chat-burst') {
    for (const [socketIndex] of sockets.entries()) send(socketIndex, { type: 'send_chat', text: `Load message ${socketIndex}` });
  }
  if (scenario === 'reconnect-storm') {
    for (const socket of sockets) socket.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const replacements = sessions.map((session) => new WebSocket(`${base.replace(/^http/, 'ws')}/api/rooms/${session.code}/connect?clientVersion=${APP_VERSION}&protocol=${PROTOCOL_VERSION}`, [`moley.v${PROTOCOL_VERSION}`, `session.${session.sessionToken}`]));
    await Promise.all(replacements.map((socket) => new Promise<void>((resolve, reject) => { socket.addEventListener('open', () => resolve(), { once: true }); socket.addEventListener('error', () => reject(new Error('reconnect failed')), { once: true }); })));
    sockets.splice(0, sockets.length, ...replacements);
  }
  if (scenario === 'simultaneous-vote') {
    send(0, { type: 'host_start' });
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const [socketIndex] of sockets.entries()) send(socketIndex, { type: 'player_ready', ready: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (let turn = 0; turn < seats + 1; turn++) { send(0, { type: 'host_advance' }); await new Promise((resolve) => setTimeout(resolve, 8)); }
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (const [socketIndex] of sockets.entries()) send(socketIndex, { type: 'submit_vote', playerId: sessions[(socketIndex + 1) % sessions.length]!.playerId });
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  for (const socket of sockets) socket.close();
  pongLatencies.sort((a, b) => a - b);
  return {
    code: host.code,
    seats,
    spectators,
    connections: sessions.length,
    connectedMs,
    heartbeatP95Ms: pongLatencies[Math.max(0, Math.ceil(pongLatencies.length * .95) - 1)] ?? null,
    missingHeartbeats: sockets.length - pongLatencies.length
  };
}

const results = await Promise.all(Array.from({ length: rooms }, (_, index) => runRoom(index)));
const totalSeats = results.reduce((sum, result) => sum + result.seats, 0);
const totalSpectators = results.reduce((sum, result) => sum + result.spectators, 0);
const slowestMs = Math.max(...results.map((result) => result.connectedMs));
const heartbeatP95Ms = Math.max(...results.map((result) => result.heartbeatP95Ms ?? 0));
const missingHeartbeats = results.reduce((sum, result) => sum + result.missingHeartbeats, 0);
console.log(JSON.stringify({ scenario, rooms, totalSeats, totalSpectators, slowestMs: Math.round(slowestMs), heartbeatP95Ms: Math.round(heartbeatP95Ms), missingHeartbeats, results }, null, 2));
import { APP_VERSION, PROTOCOL_VERSION } from '@moley/shared';
