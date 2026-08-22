import { describe, expect, it } from 'vitest';
import { canonicalHostRedirect } from '../../apps/worker/src/canonical';

describe('production host handling', () => {
  it('redirects www to the HTTPS apex and preserves path and query', async () => {
    expect(canonicalHostRedirect('http://www.moley.ca/join/amber-mole-tree?from=qr'))
      .toBe('https://moley.ca/join/amber-mole-tree?from=qr');
  });

  it('does not redirect the workers.dev preview hostname', async () => {
    expect(canonicalHostRedirect('https://moley-preview.workers.dev/api/health')).toBeNull();
  });
});
