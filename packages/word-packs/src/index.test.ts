import { describe, expect, it } from 'vitest';
import { categories, pickWord, WORD_COUNT, words } from './index';

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
});
