export function encodePackWords(words: string[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(words.slice(0, 100)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePackWords(encoded: string): string[] {
  if (!encoded || encoded.length > 16_000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return [];
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((word): word is string => typeof word === 'string').map((word) => word.trim()).filter((word) => word.length >= 1 && word.length <= 80).slice(0, 100)
      : [];
  } catch { return []; }
}

