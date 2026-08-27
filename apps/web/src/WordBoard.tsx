import type { PublicBoardWord } from '@moley/shared';

type WordBoardProps = {
  words: PublicBoardWord[];
  size: number;
  onSelect?: (word: PublicBoardWord) => void;
  label?: string;
  className?: string;
};

/** One presentation for the canonical board in online, local and TV views. */
export function WordBoard({ words, size, onSelect, label, className = '' }: WordBoardProps) {
  if (!words.length) return null;
  return <div
    className={`local-board size-${size} shared-word-board ${className}`.trim()}
    role={onSelect ? 'group' : undefined}
    aria-label={label ?? `${size} by ${size} word board`}
  >
    {words.map((word) => onSelect
      ? <button type="button" key={word.id} onClick={() => onSelect(word)}>{word.display}</button>
      : <span key={word.id}>{word.display}</span>)}
  </div>;
}
