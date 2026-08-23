import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { APP_VERSION, MAX_PROTOCOL_VERSION, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, ROOM_CODE_PARTS, normalizeRoomCode } from '@moley/shared';
import { GameRoom } from './room/GameRoom';
import { AbuseGate } from './AbuseGate';
import { apiCorsOrigin, isAllowedOrigin, json } from './security';
import type { Env } from './types';
import { canonicalHostRedirect } from './canonical';
import { runtimeConfig } from './features';

export { AbuseGate, GameRoom };

const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => {
  const redirect = canonicalHostRedirect(c.req.url);
  if (redirect) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return c.redirect(redirect, 301);
  }
  await next();
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');
  c.header('X-Frame-Options', 'DENY');
});

app.use('/api/*', cors({ origin: apiCorsOrigin, allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 86400 }));

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('Origin');
    if ((origin && !isAllowedOrigin(origin)) || c.req.header('Sec-Fetch-Site') === 'cross-site') {
      return json({ error: 'Cross-site requests are not allowed.' }, 403);
    }
    if (!(c.req.header('Content-Type') ?? '').toLocaleLowerCase('en-CA').startsWith('application/json')) {
      return json({ error: 'Send this request as JSON.' }, 415);
    }
  }
  await next();
});

function ipFrom(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? 'local';
}

function randomItem(items: readonly string[]): string {
  const max = 0x100000000;
  const limit = max - (max % items.length);
  const view = new Uint32Array(1);
  do crypto.getRandomValues(view); while (view[0]! >= limit);
  return items[view[0]! % items.length]!;
}

export function makeCode(): string { return ROOM_CODE_PARTS.map(randomItem).join(''); }

async function allowPublicAction(env: Env, networkKey: string, scope: 'create' | 'join', limit: number): Promise<boolean> {
  if (env.LOAD_TEST === 'true') return true;
  const gate = env.ABUSE_GATE.get(env.ABUSE_GATE.idFromName(networkKey));
  const response = await gate.fetch('https://gate/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, limit, windowMs: 60_000 })
  });
  return response.ok;
}

async function roomStub(env: Env, rawCode: string): Promise<DurableObjectStub | null> {
  const code = normalizeRoomCode(rawCode);
  if (code.length < 8 || code.length > 40) return null;
  return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
}

app.post('/api/rooms', async (c) => {
  if (!await allowPublicAction(c.env, ipFrom(c), 'create', 8)) return json({ error: 'Too many tunnels at once. Please wait a moment.' }, 429);
  const text = await c.req.text();
  if (text.length > 100_000) return json({ error: 'That room request was too large.' }, 413);
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(text || 'null') as unknown; } catch { return json({ error: 'That room request is not valid JSON.' }, 400); }
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) return json({ error: 'That room request is not valid JSON.' }, 400);
  const body = parsedBody as { name?: string; settings?: unknown };
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const stub = await roomStub(c.env, code);
    if (!stub) continue;
    const status = await stub.fetch('https://room/status');
    const found = await status.json() as { initialized: boolean };
    if (found.initialized) continue;
    return stub.fetch('https://room/create', { method: 'POST', body: JSON.stringify({ ...body, code }) });
  }
  return json({ error: 'Moley could not find a free tunnel. Try again.' }, 503);
});

app.get('/api/rooms/:code', () => json({ error: 'Join the room to check an invitation.' }, 405, { Allow: 'POST' }));

app.post('/api/rooms/:code/join', async (c) => {
  const networkKey = ipFrom(c);
  if (!await allowPublicAction(c.env, networkKey, 'join', 120)) return json({ error: 'Too many join attempts. Please wait a moment.' }, 429);
  const stub = await roomStub(c.env, c.req.param('code'));
  if (!stub) return json({ error: 'That room code does not look right.' }, 404);
  const text = await c.req.text();
  if (text.length > 8_000) return json({ error: 'That join request was too large.' }, 413);
  return stub.fetch('https://room/join', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moley-Network-Key': networkKey }, body: text });
});

app.get('/api/rooms/:code/connect', async (c) => {
  const stub = await roomStub(c.env, c.req.param('code'));
  if (!stub) return json({ error: 'Room not found.' }, 404);
  const url = new URL(c.req.url);
  const query = new URLSearchParams({
    clientVersion: url.searchParams.get('clientVersion') ?? '',
    protocol: url.searchParams.get('protocol') ?? ''
  });
  return stub.fetch(`https://room/connect?${query}`, { headers: c.req.raw.headers });
});

app.get('/api/config', (c) => c.json(runtimeConfig(c.env), 200, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }));
app.get('/api/health', (c) => c.json({ ok: true, service: 'moley', appVersion: APP_VERSION, protocol: PROTOCOL_VERSION, protocolRange: { min: MIN_PROTOCOL_VERSION, max: MAX_PROTOCOL_VERSION } }));

app.all('*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers(response.headers);
  const local = ['localhost', '127.0.0.1'].includes(new URL(c.req.url).hostname);
  headers.set('Content-Security-Policy', `default-src 'self'; connect-src 'self'${local ? ' ws://localhost:8787 ws://127.0.0.1:8787' : ''}; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'${local ? '' : '; upgrade-insecure-requests'}`);
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});

export default app;
