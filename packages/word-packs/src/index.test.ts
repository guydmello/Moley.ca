import { describe, expect, it } from 'vitest';
import { botSupportedWords, categories, pickWord, WORD_COUNT, words } from './index';

describe('word library', () => {
  it('contains a broad curated collection', () => {
    expect(WORD_COUNT).toBeGreaterThanOrEqual(800);
    expect(categories.length).toBeGreaterThanOrEqual(60);
    expect(new Set(words.map((word) => word.id)).size).toBe(words.length);
  });

  it('respects category and recent-word exclusions', () => {
    const first = pickWord(['Fruits'], [], () => 0);
    const next = pickWord(['Fruits'], [first.id], () => 0);
    expect(first.category).toBe('Fruits');
    expect(next.category).toBe('Fruits');
    expect(next.id).not.toBe(first.id);
  });

  it('requires rich deterministic clue support for every bot-enabled word', () => {
    expect(botSupportedWords.length).toBeGreaterThanOrEqual(12);
    for (const word of botSupportedWords) {
      expect(word.botClues, word.display).toBeDefined();
      const clues = [...word.botClues!.direct, ...word.botClues!.medium, ...word.botClues!.subtle];
      expect(new Set(clues.map((clue) => clue.toLocaleLowerCase('en-CA'))).size, word.display).toBeGreaterThanOrEqual(9);
      expect(clues.every((clue) => clue.trim() && clue.toLocaleLowerCase('en-CA') !== word.display.toLocaleLowerCase('en-CA'))).toBe(true);
    }
  });
});
