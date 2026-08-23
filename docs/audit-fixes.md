# Audit fixes applied

## Confidentiality and authorization

- Replaced public serialization of full `GameSettings` with an explicit projection that removes categories, custom words, forbidden clue words, and the blacklist.
- Restricted full host settings to the host's private projection in lobby/scoreboard stages.
- Kept crowd submissions private to their submitter and aggregate-only publicly.
- Moved reconnect tokens from URLs into the `Sec-WebSocket-Protocol` negotiation and bumped the protocol to 3.
- Added WebSocket Origin allowlisting, required protocol negotiation, stale-sequence rejection, event-ID deduplication, and single-active-tab seat ownership.
- Restricted host removal, restart, transfer, lock, and state-transition behavior on the server.

## Abuse and denial-of-service controls

- Increased room-code entropy to a four-word space exceeding one million combinations.
- Removed enumerable room status and made invitation probing uniform.
- Added a durable per-network rate limiter: 8 creates/minute and 120 joins/minute, plus a room-scoped join limiter.
- Added 100-player and 200-spectator room caps.
- Added early 100 KiB create and 8 KiB join request limits, strict JSON content type, cross-site POST rejection, bounded WebSocket messages, and action-specific rates.
- Made heartbeat replies constant-size and non-persistent instead of broadcasting snapshots.
- Reduced drawings to 32 strokes and 240 normalized points; drawing bodies are excluded from round history.

## Browser, PWA, and UX hardening

- Tightened production CSP, denied framing, added HSTS, COOP, CORP, no-sniff, referrer, and permissions policies.
- Removed bidi overrides, zero-width characters, and controls from display names while preserving legitimate emoji joiners.
- Made Unicode custom-pack links URL-safe and bounded; malformed inputs fail closed.
- Added focus traps, Escape close, and originating-control focus restoration to dialogs.
- Fixed serious colour contrast violations and displayed forbidden clues only to authorized innocent players.
- Fixed career-stat replay counting, local session validation, server-message validation, and server-sequence reset on reconnect.
- Kept service-worker caches asset-only; offline pass-the-phone remains functional.

## Test and release pipeline changes

- Added role-boundary, hostile HTTP, stale-message, Origin, malformed parser, room-code entropy, Unicode pack, accessibility, offline, and responsive regressions.
- Added Chromium, Firefox, desktop WebKit, and iOS WebKit projects.
- Added 14 review viewports from 320×800 through 3840×2160.
- CI now installs all Playwright engines and runs E2E before Cloudflare deploy.
- Split production JavaScript into bounded chunks; the previous >500 KiB chunk warning is gone.
