import { DurableObject } from 'cloudflare:workers';
import { json } from './security';
import type { Env } from './types';

type RateRequest = { scope?: unknown; limit?: unknown; windowMs?: unknown };

/** Durable, per-network admission control for expensive public HTTP actions. */
export class AbuseGate extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const body = await request.json().catch(() => null) as RateRequest | null;
    if (!body || typeof body.scope !== 'string' || body.scope.length > 32 ||
      !Number.isInteger(body.limit) || Number(body.limit) < 1 || Number(body.limit) > 500 ||
      !Number.isInteger(body.windowMs) || Number(body.windowMs) < 1_000 || Number(body.windowMs) > 3_600_000) {
      return json({ error: 'Invalid rate-limit request.' }, 400);
    }
    const key = `rate:${body.scope}`;
    const now = Date.now();
    const recent = ((await this.ctx.storage.get<number[]>(key)) ?? []).filter((time) => time > now - Number(body.windowMs));
    const allowed = recent.length < Number(body.limit);
    if (allowed) recent.push(now);
    await this.ctx.storage.put(key, recent);
    return json({ allowed }, allowed ? 200 : 429);
  }
}
