import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, clientEventSchema, normalizeGuess, normalizeName, normalizeRoomCode, safeDisplayName } from '@moley/shared';

const base = { v: PROTOCOL_VERSION, id: 'event_12345678', seq: 1 } as const;

describe('protocol validation', () => {
  it('accepts a valid vote and rejects oversized or malformed actions', () => {
    expect(clientEventSchema.safeParse({ ...base, type: 'submit_vote', playerId: 'player_12345678' }).success).toBe(true);
    expect(clientEventSchema.safeParse({ ...base, type: 'submit_vote' }).success).toBe(false);
    expect(clientEventSchema.safeParse({ ...base, type: 'send_chat', text: 'x'.repeat(281) }).success).toBe(false);
    expect(clientEventSchema.safeParse({ ...base, type: 'host_add_time', seconds: 1000 }).success).toBe(false);
    expect(clientEventSchema.safeParse({ ...base, type: 'unknown_action' }).success).toBe(false);
  });

  it('normalizes codes, names, guesses, and control characters', () => {
    expect(normalizeRoomCode(' PEACH-Frog Star ')).toBe('peachfrogstar');
    expect(normalizeName('  GuY  ')).toBe('guy');
    expect(normalizeGuess('  Crème—Brûlée!! ')).toBe('creme brulee');
    expect(safeDisplayName('A\u0000lex')).toBe('Alex');
  });
});
