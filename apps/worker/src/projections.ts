import type { GameSettings } from '@moley/shared';

/**
 * Content pools are server-only. Sending them in the public room snapshot lets a
 * Mole narrow or directly recover the secret (for example, a one-word custom
 * pack). Hosts receive their editable settings through their private projection.
 */
export function publicSettings(settings: GameSettings): GameSettings {
  return {
    ...settings,
    categories: [],
    customWords: [],
    forbiddenClueWords: [],
    wordBlacklist: []
  };
}

