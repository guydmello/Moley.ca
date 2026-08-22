import { validateBotClue } from '@moley/game-core';
import type { WordEntry } from '@moley/word-packs';
import type { Env } from './types';

export class BotAI {
  private failures = 0;
  private disabledUntil = 0;
  constructor(private env: Env) {}

  async improveInnocentClue(word: WordEntry, previousClues: string[], maxLength: number): Promise<string | null> {
    if (!this.env.AI || Date.now() < this.disabledUntil) return null;
    const prompt = [
      'You are playing a family-friendly secret-word party game.',
      `Secret word: ${word.display}. Category: ${word.category}.`,
      `Previous clues: ${previousClues.join(', ') || 'none'}.`,
      `Return JSON only: {"clue":"one subtle clue under ${maxLength} characters"}.`,
      'Never include the secret word or a spelling variation.'
    ].join('\n');
    try {
      const request = this.env.AI.run(this.env.AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast', { prompt, max_tokens: 60 });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 1800));
      const result = await Promise.race([request, timeout]) as { response?: string };
      const raw = result.response?.match(/\{[\s\S]*\}/)?.[0];
      const clue = raw ? JSON.parse(raw).clue : null;
      if (typeof clue !== 'string' || !validateBotClue(clue, word, maxLength)) throw new Error('Unsafe AI clue');
      this.failures = 0;
      return clue.trim();
    } catch {
      this.failures += 1;
      if (this.failures >= 3) this.disabledUntil = Date.now() + 5 * 60_000;
      return null;
    }
  }
}
