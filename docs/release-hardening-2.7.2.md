# Moley 2.7.2 Final Release-Hardening Report

Date: 2026-08-30

## Release

- Version: 2.7.2
- Application commit: `a6f159369b9b7e122dc671a0036f0ece3b0094aa`
- Multiplayer protocol: 4, accepted range 4 through 4
- Local persistence schema: 3
- Deployment: Cloudflare production deployment passed in GitHub Actions run `33330428768`
- Live verification: `https://moley.ca/api/health` and `/api/config` reported 2.7.2/protocol 4; the apex returned HTTPS 200 with the expected security headers; `www` and HTTP redirected to the HTTPS apex

This is a patch release because the hardening pass found one production CSS defect. Protocol, schema, rules, infrastructure, and data formats are unchanged.

## Verification performed

- `npm run check`: typecheck, zero-warning lint, 88 Vitest unit/integration tests in seven files, production PWA build, and Worker dry-run passed.
- `npm run test:e2e`: the exact application release candidate passed all 56 applicable cases in the 155-case, five-project matrix; 99 non-applicable project combinations skipped with explicit reasons and zero failures.
- The subsequently added authoritative two-Mole regression passed separately and is included in the repository's full CI gate, bringing the suite to 160 project cases: 57 applicable and 103 explicitly project-scoped skips.
- `npm audit --audit-level=high`: zero known vulnerabilities.
- Production smoke: the incorrect-human-Final-Guess journey, including every stage accessibility scan and scoreboard scoring, passed directly against `moley.ca`.
- CI run `33330428768`: install, typecheck, lint, unit tests, build, browser installation, full Playwright matrix, and Cloudflare deploy all passed.

## Human Mole Final Guess

Separate deterministic E2E cases passed for correct and incorrect typed guesses. Each completed two Clue Rounds with four humans and one bot, caught the human Mole, showed the private handoff, locked exactly one guess, blocked editing/reveal/scoring, survived reload before and after lock, then revealed and scored exactly once. Correct gave Mole +1; incorrect gave each innocent +2.

## Bot Mole Final Guess

Separate deterministic E2E cases passed for correct and incorrect Bot Mole deductions. The Bot used only its public candidate mind and board, locked one guess, exposed no secret or private guess through the public projection, survived reload, then scored Mole +1 for correct or innocents +2 for incorrect.

The escape E2E also passed: no Final Guess appeared, the Mole received +2, everyone else received zero, and scoring occurred once.

## Clue Rounds, scoring, and Multiple Moles

- Counts 1, 2, 3, 4, and 5 passed at engine level with every active human and bot acting once per pass, stable order inside a Game Round, complete clue history, and voting locked until the configured count.
- Browser acceptance verified the Classic two-pass transition and absence of early voting.
- Exact score tables cover escape, correct, incorrect, missing/timeout, one caught/one escaped, both caught with one correct/one wrong, and all wrong.
- Exact win checks cover reaching 5, exceeding 5, a single leader, ties above the target, and endless mode.
- Hosted Multiple Moles is production-supported. A six-player/two-Mole Worker E2E caught both Moles, proved the first locked guess did not reveal or score, rejected a duplicate guess, required the second guess, then revealed once and independently awarded +1/0. Engine tests cover the remaining mixed, all-wrong, escape, and timeout score strategies.

## Offline and recovery

- Chromium true-offline acceptance passed with the service worker cached and browser networking disabled. Four humans plus two bots completed setup, roles, a 5x5 board, two Clue Rounds, discussion, private voting, mandatory Final Guess, reveal, scoring, next rounds, match win, and rematch with zero `/api/` resources.
- Reload recovery passed during clues, before Final Guess, after guess lock, and after scoring without changing the word, board, order, guess, or score.
- The cache contains static application resources and no API response. Local play required no backend, WebSocket, Workers AI, or runtime API.
- A direct Playwright WebKit true-offline probe reached its offline reload and then failed with WebKit's internal page-reload error. This is documented as an automation-environment limitation, not claimed as a Safari offline pass. WebKit and iOS WebKit did pass home, role privacy/recovery, hosted multiplayer/reconnect, runtime compatibility, and the desktop WebKit modal keyboard path.

## Migration and protocol compatibility

- Schema 2 to 3 migration passed for before-clues, mid-pass, between-pass, discussion, voting, and result states. The integrated cached-PWA test downgraded a real mid-round recovery record, went offline, reloaded, migrated to schema 3, retained board/secret/order/turn, kept voting locked, and finished/scored offline.
- Protocol handshakes 2, 3, 5, missing, and invalid all returned HTTP 426 with refresh guidance. A protocol-4 socket sending a forged version-3 envelope received an error and left the room in its lobby state.

## Privacy and security

- Local TV/public projection allowlists exclude secret IDs, Mole IDs, raw votes, bot minds, clue memory, private Final Guesses, reconnect credentials, and guess fields before authorized reveal.
- Hosted Mole, innocent, spectator, display, stale, wrong-room, duplicate, and unauthorized actions are server-authorized and covered by unit/protocol security tests. Public state stays secret-free through `MOLE_GUESS`.
- Input boundaries cover malformed, script-like, oversized, control-character, Unicode, non-JSON, cross-origin, stale-sequence, and replay attempts.
- Stage-by-stage Axe scans covered Local setup, role reveal, Clue Round transitions, discussion, voting, Final Guess, locked guess, and scoreboard. The sole serious finding was fixed as described below.

## Skip inventory

There are no unconditional, temporarily disabled, or flaky Playwright tests.

- N/A/project-scoped duplicates: 97 of 103 skips. Expensive deterministic acceptance, service-worker, exact-viewport, accessibility, TV cross-window, Worker protocol, and security scenarios run in their explicitly applicable project; cross-browser home, privacy recovery, compatibility, and hosted reconnect smoke tests still run in Firefox, WebKit, and iOS WebKit.
- Environment-limited: 6 of 103 skips, representing the three true-offline service-worker flows in desktop and iOS WebKit. A direct WebKit probe documented the internal reload failure.
- Temporarily disabled: 0.
- Flaky: 0.

No critical gameplay, scoring, Final Guess, privacy, voting-authority, or offline requirement is treated as passing solely because of a skip; each has an applicable Chromium/Worker test and lower-level invariant coverage.

## Fixes made in this pass

- Changed the Local scoreboard gain colour from coral `#ff7657` (2.63:1 on white) to dark red `#a93320`, clearing the WCAG AA automated contrast check.
- Bumped the patch version from 2.7.1 to 2.7.2 to record that production code change.
- Added permanent regression tests and release evidence only; no gameplay implementation, architecture, Cloudflare configuration, protocol, or persistence format was changed.

## Remaining manual validation

- Physical HDMI/TV session
- VoiceOver, NVDA, and TalkBack sessions on real assistive-technology setups
- Human party playtest focused on subjective clue quality and handoff pacing

These are honest manual follow-ups, not known automated failures.

## Known-good baseline and rollback

- Current application baseline: `a6f159369b9b7e122dc671a0036f0ece3b0094aa` (2.7.2, protocol 4, schema 3)
- Previous known-good production baseline: `a92b8b65beded386bfc4efba8c07ca0bd341aa26` (2.7.1, protocol 4, schema 3)
- Historical 2.7.0 fallback: `0b07b95d2448610720174590af0579409da54df1`

Rollback should redeploy the chosen known-good commit through the normal CI/Cloudflare workflow. Do not rewrite Git history.
