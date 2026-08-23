# Changelog

## 2.5.0 — 2026-08-23

- Fixed a critical projection flaw that exposed custom-word and category pools to Moles and spectators.
- Moved reconnect credentials out of WebSocket URLs and into the negotiated subprotocol; added first-party Origin checks and single-active-tab sessions.
- Expanded cryptographically generated room codes from 1,728 possibilities to more than one million and removed enumerable room-status responses.
- Added durable create/join throttling, room-level join limits, action-specific rate limits, 100-player and 200-spectator caps, and early body-size rejection.
- Added stale-sequence enforcement, bounded drawing payloads, lightweight heartbeat responses, and stricter host/state permissions.
- Hardened CSP and response headers, Unicode display-name handling, custom-pack link encoding, local career-stat idempotency, and modal keyboard/focus behavior.
- Added automated projection, protocol abuse, accessibility, offline PWA, responsive, Firefox, WebKit, iOS WebKit, and controlled local load coverage.
- Updated CI to install all supported Playwright engines and block deployment on the E2E suite.

## 2.4.0 — 2026-08-23

- Added server-enforced feature lifecycles and remote kill switches.
- Added explicit app/protocol compatibility, stale-client refresh guidance and migration-safe v1 room loading.
- Added Quick, Family, Chaos and Sweaty presets while keeping Classic unchanged.
- Added searchable, dependency-aware host settings and modified-preset summaries.
- Added emoji, anonymous and bounded vector drawing clues, forbidden words and private notebooks.
- Added defence, one optional revote, confidence voting and configurable vote reveals.
- Added reactions, spectator predictions, audience totals, round recaps, match timelines, awards and shareable result cards.
- Added same-score, reset-score and change-settings rematches plus device-only career totals.
- Added bot quick-fill, names, visible personalities and AFK autopilot/reclaim foundations.
- Expanded Canada content and added dated Internet Culture pack metadata.
- Added custom pack import/export/share links, crowd-word submissions, duplicate detection, blacklists and stronger recent-word filters.
- Added network quality, Wake Lock, install education, accessibility quick settings, Canadian French string foundations, diagnostics and sanitized support codes.

Classic defaults, scoring and private role boundaries remain unchanged.
