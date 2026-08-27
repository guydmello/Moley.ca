# Moley 2.7 security summary

Audit date: 2026-08-27
Release candidate: 2.7.0 / protocol 3

## Result

The authorized source review and controlled local dynamic test found no unresolved Critical or High application-security issue. The audit covered online authority, host/player/Mole/innocent/spectator/TV/bot capabilities, offline persistence, the canonical board, custom content, bots, chat, drawings, voting, audience actions, final guesses, scoring, reconnects, and both public-display implementations.

This is not an independent third-party penetration test. No destructive load was directed at Cloudflare production.

## Controls verified

| Boundary | Verification |
| --- | --- |
| Secret word and roles | Mole, spectator, and display snapshots omit the word and content pools; only the receiving innocent gets the word; roles are per-seat private envelopes |
| Canonical board | 5≤size≤10 is validated in schemas and authority; Unicode/punctuation/plural normalization prevents duplicate board words; all clients receive the same public candidate board |
| Online TV | Explicit read-only display capability; hidden from roster; cannot chat/react/predict/vote/clue/host; minimal empty-token private state |
| Local TV | Strict allowlisted public projection, recursive forbidden-key test, raw localStorage inspection before reveal, session validation, no `LocalGameState` transport |
| Host authority | Non-host host actions rejected; host capability comes only from the token-bound socket seat |
| Reconnect capability | 192-bit token stored locally and sent in the WebSocket subprotocol; removed from URL query strings; invalid tokens fail; one active socket per seat |
| Voting and scoring | Server/local stage, target, self-vote, duplicate-vote, mandatory-guess, and score-once guards; rejected WebSocket actions restore the complete pre-action room snapshot |
| Audience privacy | Predictions remain owner-private and reactions owner-bounded; public state receives only aggregate totals after reveal |
| Bots | Mole clue/guess API receives candidates, public observations, difficulty, and randomness—never the answer; innocent secrets use audited clue metadata |
| Input | Zod/bounded schemas, normalized names/words, board size, clue/chat/note/guess/custom/drawing/event limits, body/frame caps, React text rendering |
| Abuse | Durable create/join throttles, room/player/spectator caps, generic per-seat event bucket, specific chat/drawing/crowd limits, bounded reactions and AI adapter |
| Persistence | Local schema migration plus deep fail-closed validation; online room deletion alarms; private reveal UI state not persisted; API cache denylist |
| HTTP/browser | Origin, content type, body size, protocol range, uniform room probes, CSP, HSTS, frame denial, no-sniff, COOP/CORP, restrictive permissions/referrer policy |
| Supply chain | 687 packages audited with 0 vulnerabilities; no service credential is shipped to the client |

## Data lifecycle

The authoritative lifecycle table is [`private-data-inventory.md`](./private-data-inventory.md). Online disconnected lobbies are deleted after two inactive hours, in-progress rooms after six, and completed matches after 24. A disconnected non-host seat is reserved for two minutes. Local authority state remains only on the device until **Start Fresh**, browser eviction, or site-data clearing.

## Automated security evidence

- 75 unit/integration tests: schemas, transitions, scoring, 300 production boards, duplicate attacks, local migrations, recursive public projection, 50-round bot stress.
- Live local Worker tests: host escalation, stale sequence, duplicate vote, malformed/oversized/cross-site HTTP, uniform status probe, invalid reconnect token, custom-pool isolation, Mole/spectator/display secret isolation, read-only display, and audience privacy.
- Browser tests: token-free WebSocket URLs, separate host/display sessions, online/local TV, Back/Forward privacy, production PWA cache inspection, modal focus, and Axe scans.
- Controlled load: 100-seat fanout and reconnect plus 40 simultaneous votes, all with zero missing heartbeats.

## Residual risks and honest limits

- A room code is intentionally a bearer invitation, not identity authentication. Entropy and throttles reduce guessing; active codes should still not be posted publicly.
- Reconnect tokens remain in origin-local storage to support recovery. XSS prevention and CSP therefore remain important; Moley loads no third-party scripts.
- Local-device privacy is a social handoff boundary, not cryptographic protection from the device owner or browser developer tools.
- `style-src 'unsafe-inline'` remains for current React inline styles; `unsafe-eval` is not allowed.
- Real screen readers, physical-device audio/haptics, and multi-person social observation remain manual gates.
- Cloudflare account limits and edge behaviour require post-deployment smoke verification; controlled local load is not a production capacity guarantee.

## Severity disposition

| Severity | Open |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 0 known and practical to fix in this release |
| Low / informational | Residual product and physical-device limits documented above |
