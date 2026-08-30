# Moley 2.7.1 Offline-First Stabilization Report

Date: 2026-08-30

## Root Causes Found

- The earlier Local loop treated a full player pass as the whole clue phase, so turn-index completion could move directly to discussion without an explicit multi-pass rule or durable Clue Round counters.
- The previous caught-bot branch could continue to scoring instead of entering the same Final Guess state used by a human Mole. Reveal and scoring were therefore not universally gated by a locked guess.
- Local setup presented rule presets, bot composition, privacy handoff, TV presentation, and offline capability as peer modes even though they use one engine.
- Normal bot selection could consume direct clues before safer medium/subtle options and did not retain enough clue context across passes.

## Fixed

- Local and online games now complete the configured one to five Clue Rounds before voting. Classic defaults to two.
- Turn order stays fixed across Clue Rounds in the same Game Round and changes only when the next Game Round begins.
- The local engine and online authority reject early voting, early vote resolution, early scoring, and duplicate scoring.
- A caught Mole must make one locked Final Guess before the secret word is revealed or the round is scored. This now applies to both human and bot Moles.
- Local play now pauses after each pass with an explicit Clue Round completion screen, and pauses again before discussion after the final configured pass.
- Final Guess outcomes use the exact Classic scoring contract: an escaped Mole gets two points, a caught Mole with a correct guess gets one point, and innocents get two points when the caught Mole guesses incorrectly.
- Existing 2.7.0 local saves and active rooms receive safe Clue Round migration defaults.

## Changed

- The home screen now has one Local / Offline entry instead of duplicate local and Pass-the-Phone calls to action.
- Local gameplay presets are Quick (one Clue Round), Classic (two), Detective (three), Long (four), and Five Rounds (five).
- Presentation is selected independently as One Device or TV / Second Screen.
- Local, online, and TV views use explicit Game Round and Clue Round progress terminology.
- The setup action always remains **Start Local Game**; unmet requirements appear as specific nearby validation instead of replacing the action label.
- Local persistence is schema 3, multiplayer protocol is 4, and every workspace package reports version 2.7.1.

## Shared Across Modes

- The same normalized clue-round setting, progression counters, scoring rules, and result shape are used by local and hosted play.
- Both modes retain clue history through the entire Game Round and expose the Final Guess only in the resolved recap.
- Both modes preserve the secret word until the mandatory Final Guess is locked.

## Bot Improvements

- Normal bots prioritize medium and subtle clues before direct clues; Sneaky bots favor subtle clues; Easy bots may be more direct.
- Curated clue metadata was expanded and fallback combinations diversify bot-heavy games without leaking the answer.
- Bot clue and candidate history persists across all Clue Rounds, preventing avoidable repeats.
- Optional hosted AI instructions prohibit direct clues, and direct-answer candidates are rejected server-side.
- Local play remains deterministic and performs no AI or network request.

## Security and Privacy

- Public room, spectator, and TV projections exclude the secret word, concealed roles, raw votes, private notes, bot reasoning, and uncommitted Final Guesses.
- Raw votes, guesses, notes, and bot memory are cleared after a safe recap is created.
- The server remains authoritative for stage transitions, vote timing, Final Guess authorization, and scoring.
- Local TV uses an allowlisted public schema and never projects private local fields.

## Tests

- The original 2.7.1 gate passed type checking, linting, 84 Vitest unit/integration tests in seven files, the production PWA build, the Worker dry-run, and 49 applicable Playwright cases with zero failures.
- The final hardening evidence is superseded by `docs/release-hardening-2.7.2.md`, which records the expanded 88-test unit gate, 160-case browser matrix, bot audit, integrated migration, protocol matrix, and production smoke.
- Focused cross-browser home regression: 10 of 10 passed.
- Added direct coverage for one through five Clue Rounds, stable order, early-action rejection, human and bot Final Guess locking, exact scoring, idempotency, schema migration, offline recovery, TV privacy, reconnects, and hosted authority boundaries.
- Dependency audit: zero known vulnerabilities at validation time.

## Offline Validation

- Loaded the production PWA, waited for its service worker cache, disabled the browser network, and reloaded Local Play.
- Configured four humans, two deterministic bots, a 5×5 board, two Clue Rounds, First to 5, and Fast Bots.
- Completed all six turns in Clue Round 1, proved voting was absent, used the explicit round transition, retained the identical six-seat order for Clue Round 2, refreshed mid-pass, and resumed the exact next player and order.
- Completed private voting, deliberately caught the Mole, required and locked the human-or-bot Final Guess, refreshed while the guess was locked, revealed once, and verified the authoritative score path.
- Confirmed no `/api/` resource request occurred while offline. The focused acceptance test passed in desktop Chromium; four non-target browser projects skipped by design.

## Remaining

- Automated browser emulation cannot replace a physical HDMI/TV session, real-device assistive-technology testing, or extended human playtesting. Those are recommended release follow-ups, not known software blockers.
- Optional early-ending of clue collection was intentionally not added; every configured Clue Round is required before voting.
- `a92b8b65beded386bfc4efba8c07ca0bd341aa26` is the known-good 2.7.1 production baseline. The accessibility hardening patch advanced production to 2.7.2 at `a6f159369b9b7e122dc671a0036f0ece3b0094aa`; `0b07b95d2448610720174590af0579409da54df1` remains the historical 2.7.0 fallback point.
