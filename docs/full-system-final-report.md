# Moley 2.7 full-system final report

Audit and release date: 2026-08-27

## What was reviewed

The review covered the landing/create/join experience, online Worker and Durable Object authority, shared protocol/settings, full round state machine, Local Play authority and persistence, public/private projections, online and local TV, boards and word packs, deterministic bots, advanced feature flags, PWA/service worker, accessibility, responsive layouts, security controls, load behaviour, tests, documentation, CI, and production delivery.

The discovery record and per-feature decisions are in [`full-feature-map.md`](./full-feature-map.md). The private-state lifecycle is in [`private-data-inventory.md`](./private-data-inventory.md). The no-blank PASS/N/A matrix is in [`full-system-test-matrix.md`](./full-system-test-matrix.md).

## Features unified

- One normalized catalog, deduplication policy, exact-size board builder, fair turn-order policy, Classic scoring engine, mandatory Mole-guess rules, and deterministic bot helpers now serve online and local authority.
- One `WordBoard` component renders online players, local players, and both TV presentations.
- Local Party, Pass the Phone, TV Display, Public Display, and Host Controls terminology and rules now describe the same underlying game.
- The duplicate legacy PassThePhone engine was removed; both local routes use `LocalPlay`.

## Online features added

- Server-authoritative Board Play from 5×5 through 10×10, persisted through reconnects and projected identically to players, spectators, and TV.
- Fair round order with exact-repeat prevention and recent-first soft avoidance.
- Coordinated unique bot clues, bounded clue memory, candidate-based Mole behaviour, and shared discussion lines.
- Central configuration compatibility validation for board capacity, filters, custom packs, and bots.
- Explicit read-only display participants with separate browser session storage, roster exclusion, empty-token private snapshots, and action denial.
- Whole-room snapshot rollback for rejected WebSocket mutations, restart fairness accounting, and server enforcement that host/timer paths cannot bypass the caught Mole’s final guess.

## Offline features added

- A true same-origin Local TV route driven only by an allowlisted public projection and capable of attaching, reloading, detaching, and reopening mid-match without a backend.
- Schema-2 local persistence with v1 migration, deep structural validation, fail-closed corruption handling, and preserved private word/roles/board/order for valid upgrades.
- Explicit private/pass/public visibility for roles, votes, and the final Mole guess, with navigation and page-hide privacy reset.
- Local sound and haptics preferences plus production-PWA testing with network, backend, and AI unavailable.

## Local/TV improvements

- Local Host Controls expose TV at the moments it is useful and remove result-stage no-op actions.
- The TV shows the canonical board, public clue/order progress, vote count, scores, results, and a stale-host signal; it never receives the authority save.
- Phone, laptop, and TV layouts support every board size without horizontal overflow in the tested matrix.
- `Start Fresh` removes both the private recovery save and session public-display snapshot.

## Bot improvements

- Innocent bots choose approved semantic clues on their actual turn, reject normalized duplicates against current clues and bounded history, and use curated supported secrets when a custom-only configuration lacks bot metadata.
- Mole bots update confidence from public candidate words and revealed clues. The final-guess function has no secret/answer parameter.
- Online and local discussion use the same state-derived generator; quiet/personality/difficulty behaviour remains deterministic without Workers AI.
- Stress evidence includes 50 10×10 rounds with one human and 10 bots, unique clue reservation tests, and explicit Mole information-boundary tests.

## Board improvements

- One shared builder enforces integer sizes 5–10, exact `size²` capacity, required secret inclusion, and normalized uniqueness.
- Unicode decomposition, punctuation/symbol/whitespace normalization, and conservative plural folding block crafted duplicate packs.
- 300 production boards were sampled automatically; every board size was also rendered on phone, laptop, and TV form factors.

## Security fixes

- Removed the redundant reconnect token from WebSocket URLs; authentication remains in the negotiated subprotocol and local recovery storage.
- Added explicit display capabilities and strict online/local public projections.
- Added local state/config/action guards and online whole-snapshot rollback after errors.
- Added audience privacy coverage, invalid-token checks, role/host escalation checks, malformed/stale event checks, custom-pool isolation, and cache inspection.
- Open Critical: 0. Open High: 0. Known practical Medium findings: 0. Residual social/device/account risks are recorded in [`security-summary.md`](./security-summary.md).

## UX improvements

- How to Play now explains canonical boards, fair round order, mandatory guesses, neutral handoffs, and TV privacy.
- Mole category presentation handles visible, hidden, and Mystery Category states coherently.
- Local final guessing and voting return to a neutral screen before showing private controls.
- Colour contrast issues found by staged Axe scans were corrected; modal focus restoration is covered in Chromium and WebKit.

## Performance improvements

- Advanced UI remains code-split (`FeatureSettingsDialog`, `DrawingPad`, and `LocalPublicDisplay`). The base application chunk is 152.72 KiB raw / 48.42 KiB gzip; the Local TV chunk is 5.60 KiB raw / 2.05 KiB gzip.
- Worker dry-run upload is 728.92 KiB raw / 129.93 KiB gzip.
- The 50-round offline bot stress completes under its 2.5-second test budget.
- Controlled local results: 100-seat fanout 4,475ms / p95 109ms; 100-seat reconnect storm 4,460ms / p95 106ms; 40-seat simultaneous votes 1,369ms / p95 14ms; zero missing heartbeats in all three.

## Tests run

- `npm run check`: type checking for every workspace, ESLint zero warnings, 7 Vitest files / 75 tests, Vite build, Wrangler dry-run — PASS.
- `npm run test:e2e`: 48 executed / 67 intentional project skips across 115 project cases — PASS.
- Engines: mobile Chromium, desktop Chromium, Firefox, desktop WebKit, iOS WebKit emulation — PASS.
- Explicit device matrix: 14 required phone/tablet/laptop/desktop/TV viewports — PASS.
- Board matrix: six sizes × phone/laptop/TV = 18 layouts — PASS.
- Offline production PWA, Local TV, online TV, reconnect, accessibility, security, advanced settings, and navigation flows — PASS.
- Dependency audit: 542 packages, 0 vulnerabilities — PASS.
- CI release run 33119696033: type checking, zero-warning lint, 75 unit/integration tests, production build, 48 browser cases / 67 intentional project skips, and Cloudflare deploy — PASS.

## Remaining limitations

- Practice, special roles, side missions, moderator capability, tournaments/events, account-backed achievements, Moley Lab, and replay dashboard do not exist and are not advertised. They are `N/A`, not hidden failures.
- Local Classic intentionally supports one Mole and a focused flow; online supports multiple Moles and advanced clue/vote variants.
- Physical phones/tablets/TVs, real screen readers, real haptics/audio, and multi-person social pacing were not observed in this automated environment.
- Controlled local load does not prove Cloudflare account capacity; destructive production load was not run.
- This authorized audit is not an independent third-party penetration test.

## Final readiness

The 2.7 release meets the defined gameplay, privacy, offline, display, bot, board, responsive, accessibility, security, CI, deployment, and live-smoke standards. It is ready for production within the physical-device, third-party-assessment, and Cloudflare-capacity limitations above.

## Production verification

- Feature release commit: `743dd0c743de5ab88853760f9812452204a921f2`
- Final release commit: `54c97e1df70d7751855d8791d01e61cec081fc1b`
- GitHub Actions: run `33119696033` passed every gate and deployed in 6m19s.
- Cloudflare deployment: Worker version `8b3b88f9-91a5-4bc2-9760-a70c3757f8d7`; active on `moley.ca`, `www.moley.ca`, and `moley.guyrdmello.workers.dev`.
- Live API: `/api/health` returned HTTP 200 with app 2.7.0 and protocol 3; `/api/config` returned the compatible 2.7.0 release configuration.
- Live edge: apex and `/local/display` returned HTTP 200; HSTS, CSP, frame, MIME, referrer, permissions, opener, and resource policies were present; `www` returned HTTP 301 to the apex while preserving `/how-to-play?ref=release`.
- Live application smoke: create/settings/config, full two-human/two-bot gameplay setup, private roles, board consistency, display separation, reconnect, host transfer, malformed/oversized/cross-site HTTP rejection, and invalid reconnect rejection passed. The deliberate burst then returned HTTP 429 at the configured durable create limit, confirming production throttling.
