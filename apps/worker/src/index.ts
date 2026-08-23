import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { APP_VERSION, MAX_PROTOCOL_VERSION, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, normalizeRoomCode } from '@moley/shared';
import { GameRoom } from './room/GameRoom';
import { apiCorsOrigin, json, SlidingRateLimit } from './security';
import type { Env } from './types';
import { canonicalHostRedirect } from './canonical';
import { runtimeConfig } from './features';

export { GameRoom };

const app = new Hono<{ Bindings: Env }>();
const rateLimit = new SlidingRateLimit();
const codeWords = [
  ['amber', 'blue', 'brave', 'cozy', 'fuzzy', 'happy', 'lucky', 'peach', 'quiet', 'silver', 'tiny', 'warm'],
  ['badger', 'beaver', 'biscuit', 'comet', 'duck', 'fox', 'frog', 'mole', 'moon', 'otter', 'panda', 'rocket'],
  ['acorn', 'cake', 'cloud', 'leaf', 'pea', 'star', 'toast', 'tree', 'tunnel', 'waffle', 'wave', 'whistle']
] as const;

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
});

app.use('/api/*', cors({ origin: apiCorsOrigin, allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 86400 }));

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

function makeCode(): string { return codeWords.map(randomItem).join(''); }

async function roomStub(env: Env, rawCode: string): Promise<DurableObjectStub | null> {
  const code = normalizeRoomCode(rawCode);
  if (code.length < 8 || code.length > 40) return null;
  return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
}

app.post('/api/rooms', async (c) => {
  if (c.env.LOAD_TEST !== 'true' && !rateLimit.allow(`create:${ipFrom(c)}`, 12, 60_000)) return json({ error: 'Too many tunnels at once. Please wait a moment.' }, 429);
  const body = await c.req.json().catch(() => null) as { name?: string; settings?: unknown } | null;
  if (!body || JSON.stringify(body).length > 12_000) return json({ error: 'That room request was too large.' }, 413);
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

app.get('/api/rooms/:code', async (c) => {
  const stub = await roomStub(c.env, c.req.param('code'));
  return stub ? stub.fetch('https://room/status') : json({ initialized: false }, 404);
});

app.post('/api/rooms/:code/join', async (c) => {
  if (c.env.LOAD_TEST !== 'true' && !rateLimit.allow(`join:${ipFrom(c)}`, 40, 60_000)) return json({ error: 'Too many join attempts. Please wait a moment.' }, 429);
  const stub = await roomStub(c.env, c.req.param('code'));
  if (!stub) return json({ error: 'That room code does not look right.' }, 404);
  const text = await c.req.text();
  if (text.length > 12_000) return json({ error: 'That join request was too large.' }, 413);
  return stub.fetch('https://room/join', { method: 'POST', body: text });
});

app.get('/api/rooms/:code/connect', async (c) => {
  const stub = await roomStub(c.env, c.req.param('code'));
  if (!stub) return json({ error: 'Room not found.' }, 404);
  const url = new URL(c.req.url);
  const query = new URLSearchParams({
    token: url.searchParams.get('token') ?? '',
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
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss: http://localhost:8787; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});

export default app;
