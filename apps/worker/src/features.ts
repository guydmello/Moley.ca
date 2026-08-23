import { APP_VERSION, MAX_PROTOCOL_VERSION, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, defaultFeatureFlags, featureKeySchema, featureLifecycleSchema, type FeatureFlags, type RuntimeConfig } from '@moley/shared';
import type { Env } from './types';

export function runtimeFeatures(env: Env): FeatureFlags {
  const flags = { ...defaultFeatureFlags };
  if (env.FEATURE_FLAGS_JSON) {
    try {
      const configured = JSON.parse(env.FEATURE_FLAGS_JSON) as Record<string, unknown>;
      for (const [rawKey, rawValue] of Object.entries(configured)) {
        const key = featureKeySchema.safeParse(rawKey);
        const value = featureLifecycleSchema.safeParse(rawValue);
        if (key.success && value.success) flags[key.data] = value.data;
      }
    } catch { /* Invalid remote configuration fails closed to checked-in defaults. */ }
  }
  for (const key of featureKeySchema.options) {
    const killed = env[`KILL_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}` as keyof Env];
    if (killed === 'true') flags[key] = 'disabled';
  }
  return flags;
}

export function runtimeConfig(env: Env): RuntimeConfig {
  return {
    appVersion: APP_VERSION,
    protocol: PROTOCOL_VERSION,
    protocolRange: { min: MIN_PROTOCOL_VERSION, max: MAX_PROTOCOL_VERSION },
    features: runtimeFeatures(env),
    release: {
      title: 'Replayability upgrade',
      publishedAt: '2026-08-23',
      highlights: ['More ways to give clues', 'Defence, confidence and richer recaps', 'New presets, bots and party controls']
    }
  };
}
