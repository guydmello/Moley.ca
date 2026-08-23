import { normalizeName, safeDisplayName } from '@moley/shared';
import type { StoredPlayer } from './types';

const API_ORIGINS = new Set([
  'https://moley.ca',
  'https://www.moley.ca',
  'https://moley.guyrdmello.workers.dev',
  'http://127.0.0.1:5190',
  'http://localhost:5190'
]);

export function apiCorsOrigin(origin: string): string | undefined {
  return API_ORIGINS.has(origin) ? origin : undefined;
}

export function isAllowedOrigin(origin: string | null): boolean {
  return typeof origin === 'string' && API_ORIGINS.has(origin);
}

export function newSecret(bytes = 24): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/[+/=]/g, (char) => ({ '+': '-', '/': '_', '=': '' })[char]!);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function validateName(raw: unknown, players: StoredPlayer[]): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a display name to join the room.' };
  const name = safeDisplayName(raw);
  if (!name) return { ok: false, error: 'Enter a display name to join the room.' };
  if (players.some((player) => normalizeName(player.name) === normalizeName(name))) {
    return { ok: false, error: 'Someone in this room is already using that name.' };
  }
  return { ok: true, name };
}

export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extra
    }
  });
}

export class SlidingRateLimit {
  private buckets = new Map<string, number[]>();
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.buckets.get(key) ?? []).filter((time) => time > now - windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    this.buckets.set(key, recent);
    if (this.buckets.size > 1000) {
      for (const [bucket, times] of this.buckets) if (times.every((time) => time <= now - windowMs)) this.buckets.delete(bucket);
    }
    return true;
  }
}
