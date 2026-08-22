export function canonicalHostRedirect(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  if (url.hostname.toLowerCase() !== 'www.moley.ca') return null;

  url.protocol = 'https:';
  url.hostname = 'moley.ca';
  url.port = '';
  return url.toString();
}
