import { describe, expect, it } from 'vitest';
import { canonicalHostRedirect } from '../../apps/worker/src/canonical';
import { apiCorsOrigin } from '../../apps/worker/src/security';

describe('production host handling', () => {
  it('redirects www to the HTTPS apex and preserves path and query', async () => {
    expect(canonicalHostRedirect('http://www.moley.ca/join/amber-mole-tree?from=qr'))
      .toBe('https://moley.ca/join/amber-mole-tree?from=qr');
  });

  it('does not redirect the workers.dev preview hostname', async () => {
    expect(canonicalHostRedirect('https://moley-preview.workers.dev/api/health')).toBeNull();
  });

  it('allows only first-party and local development API origins', () => {
    expect(apiCorsOrigin('https://moley.ca')).toBe('https://moley.ca');
    expect(apiCorsOrigin('https://moley.guyrdmello.workers.dev')).toBe('https://moley.guyrdmello.workers.dev');
    expect(apiCorsOrigin('http://127.0.0.1:5190')).toBe('http://127.0.0.1:5190');
    expect(apiCorsOrigin('https://attacker.example')).toBeUndefined();
  });
});
