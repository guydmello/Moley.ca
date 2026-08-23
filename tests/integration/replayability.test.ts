import { describe, expect, it } from 'vitest';
import { MAX_DRAWING_POINTS, clientEventSchema, defaultFeatureFlags, drawingPayloadSchema, featureEnabled, modifiedSettingKeys, presetSettings, settingsSchema } from '@moley/shared';
import { runtimeFeatures } from '../../apps/worker/src/features';
import { decodePackWords, encodePackWords } from '../../apps/web/src/pack-codec';

describe('replayability release contracts', () => {
  it('keeps Classic unchanged and new presets opt-in', () => {
    expect(presetSettings.classic.clueMode).toBe('spoken');
    expect(presetSettings.classic.defenceSeconds).toBe(0);
    expect(presetSettings.classic.chaosMode).toBe(false);
    expect(presetSettings.chaos.chaosMode).toBe(true);
    expect(modifiedSettingKeys({ ...presetSettings.quick, votingSeconds: 99 })).toContain('votingSeconds');
  });

  it('validates bounded vector drawings and rejects uploads or excessive points', () => {
    const drawing = { strokes: [{ points: [[0.1, 0.2], [0.8, 0.9]], color: 'ink', width: 0.01 }] };
    expect(drawingPayloadSchema.safeParse(drawing).success).toBe(true);
    expect(clientEventSchema.safeParse({ v: 3, id: 'event_drawing1', seq: 1, type: 'submit_drawing', drawing }).success).toBe(true);
    const oversized = { strokes: [{ points: Array.from({ length: MAX_DRAWING_POINTS + 1 }, () => [0.1, 0.1]) }] };
    expect(drawingPayloadSchema.safeParse(oversized).success).toBe(false);
  });

  it('fails remote kill switches closed on the server', () => {
    const flags = runtimeFeatures({ FEATURE_FLAGS_JSON: '{"drawing":"production"}', KILL_DRAWING: 'true' } as never);
    expect(flags.drawing).toBe('disabled');
    expect(featureEnabled(flags, 'drawing')).toBe(false);
    expect(featureEnabled(defaultFeatureFlags, 'chat')).toBe(true);
  });

  it('enforces settings limits for abuse-prone features', () => {
    expect(settingsSchema.safeParse({ forbiddenClueWords: Array.from({ length: 41 }, (_, index) => `word${index}`) }).success).toBe(false);
    expect(settingsSchema.safeParse({ customWords: Array.from({ length: 1001 }, (_, index) => `word${index}`) }).success).toBe(false);
  });

  it('round-trips bounded Unicode pack links and rejects malformed payloads', () => {
    const encoded = encodePackWords(['Crème brûlée', '🏒 Hockey']);
    expect(decodePackWords(encoded)).toEqual(['Crème brûlée', '🏒 Hockey']);
    expect(decodePackWords('__proto__%')).toEqual([]);
    expect(decodePackWords('a'.repeat(16_001))).toEqual([]);
  });
});
