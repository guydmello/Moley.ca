import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, ROOM_CODE_PARTS, clientEventSchema, formatRoomCode, normalizeGuess, normalizeName, normalizeRoomCode, safeDisplayName } from '@moley/shared';
import { publicSettings } from '../../apps/worker/src/projections';
import { settingsSchema } from '@moley/shared';

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
    expect(safeDisplayName('A\u202Elex\u200B')).toBe('Alex');
  });

  it('uses a million-plus invitation space and formats four-word codes', () => {
    expect(ROOM_CODE_PARTS.reduce((total, list) => total * list.length, 1)).toBeGreaterThan(1_000_000);
    const code = ROOM_CODE_PARTS.map((list) => list[0]).join('');
    expect(normalizeRoomCode(code)).toBe(code);
    expect(formatRoomCode(code).split(' ')).toHaveLength(4);
  });

  it('never projects secret content pools into public room settings', () => {
    const settings = settingsSchema.parse({
      categories: ['Secrets'], customWords: ['TOPSECRET'], forbiddenClueWords: ['alias'], wordBlacklist: ['blocked']
    });
    const projected = publicSettings(settings);
    expect(projected.categories).toEqual([]);
    expect(projected.customWords).toEqual([]);
    expect(projected.forbiddenClueWords).toEqual([]);
    expect(projected.wordBlacklist).toEqual([]);
    expect(JSON.stringify(projected)).not.toContain('TOPSECRET');
  });

  it('rejects hostile parser shapes without prototype pollution or exceptions', () => {
    const hostile: unknown[] = [
      null, [], '', 42, true,
      { ...base, type: 'submit_drawing', drawing: { strokes: [{ points: [[Number.NaN, 0]] }] } },
      { ...base, type: 'submit_drawing', drawing: { strokes: [{ points: [[Number.POSITIVE_INFINITY, 0]] }] } },
      { ...base, type: 'send_chat', text: { toString: '<script>alert(1)</script>' } },
      { ...base, v: PROTOCOL_VERSION + 1, type: 'heartbeat' },
      JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}')
    ];
    for (const value of hostile) expect(() => clientEventSchema.safeParse(value)).not.toThrow();
    for (const value of hostile) expect(clientEventSchema.safeParse(value).success).toBe(false);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
