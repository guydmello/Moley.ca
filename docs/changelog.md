# Changelog

## 2.7.0 — 2026-08-27

- Unified online and offline gameplay around one normalized board builder, catalog filter, fair turn-order policy, Classic scoring engine, mandatory Mole-guess rules, and deterministic bot helpers.
- Added server-authoritative online Board Play from 5×5 through 10×10 with one canonical board shared across players, reconnects, spectators, and TV Display.
- Added a true Local TV Display with an allowlisted public projection, BroadcastChannel plus storage-event recovery, mid-match attach/reload/detach/reopen support, large-screen layouts, and stale-host status.
- Added explicit Private / Pass / Public local visibility, including neutral vote and final-Mole-guess handoffs and Back/Forward/page-hide privacy resets.
- Added schema-2 local saves with v1 migration, deep state/configuration validation, corruption fail-closed behavior, and preserved private board/order state during valid upgrades.
- Improved online and local bots with coordinated unique clue memory, curated fallback secrets for custom-only setups, shared discussion reasoning, and a Mole candidate/guess API that cannot receive the answer.
- Added fair online round ordering with exact-repeat prevention, fixed restart Mole-history accounting, protected mandatory final guesses from host skipping, and made WebSocket mutations rollback atomically on rejected actions.
- Added an explicit read-only online display capability, separate display-session persistence, roster exclusion, minimal private envelopes, and removed reconnect tokens from WebSocket URLs.
- Removed the duplicate legacy PassThePhone engine, standardized Local Party / TV Display / Host Controls language, expanded How to Play guidance, and added local sound/haptic controls.
- Expanded unit, protocol, privacy, accessibility, offline, cross-browser, local-TV, exact device, and every-board-size coverage; added 300 production-board samples and retained the 50-round bot-heavy offline stress test.

## 2.6.0 — 2026-08-27

- Promoted Local Play to a primary home-screen mode with Local Classic, Local + Bots, Pass the Phone, Big Screen Party, and Offline Cottage presets.
- Added a browser-authoritative local engine built on the same `@moley/game-core` rules used by online rooms, with 5×5 through 10×10 boards, complete rounds, secret voting, scoring, match completion, and rematches.
- Added IndexedDB recovery with an encoded write-ahead fallback, explicit resume/new-game choices, and graceful partial recovery for damaged saves.
- Added fair randomized clue order per round, full order display, bot/human inclusion, and protection against repeating the identical order in consecutive rounds.
- Added structured bot clue metadata, normalized per-round clue reservation, difficulty/personality variation, repeated-word memory, deterministic Mole deduction, contextual voting, and unique discussion lines.
- Added device-only custom packs and kept bot secrets restricted to entries with audited deterministic clue support.
- Removed local-mode runtime configuration fetching so cached Local Play makes no backend, WebSocket, Workers AI, or API request.
- Added true network-disabled PWA coverage, Back/Forward privacy recovery, 50-round 10×10/10-bot simulation, semantic clue tests, board uniqueness tests, and bot-coverage gates.

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
