# Feature expansion audit

Date: 2026-08-23  
Baseline: Moley 2.0.0 production rebuild

## Executive summary

Moley already has a strong server-authoritative multiplayer core: private reconnect tokens, Durable Object persistence, role-specific projections, a versioned WebSocket envelope, deterministic bots with optional Workers AI, spoken/typed clues, chat, spectators, TV display, pass-the-phone, PWA assets, and short room retention. The requested replayability release is nevertheless a major protocol and product expansion. Most replayability systems, advanced clue types, recap/stat systems, remote operations controls, accessibility controls, and content tooling do not yet exist.

The implementation must preserve three invariants:

1. **Classic stays simple.** Its default flow and information model must not change.
2. **The server remains authoritative.** Roles, words, drawings, notes, votes, predictions, timers, bot actions, flags, and results cannot be trusted from the client.
3. **Private information stays private.** Concealed role data, notebooks, confidence choices before reveal, predictions before close, and reconnect tokens must never enter a public room projection or logs.

## Existing

| Area | Current implementation | Reuse plan |
| --- | --- | --- |
| Multiplayer authority | One SQLite-backed `GameRoom` Durable Object per room with hibernatable WebSockets | Extend the persisted snapshot with migration-safe defaults and new stages/actions |
| Reconnect | Private seat token, local restoration, exponential retry, host grace/transfer | Add version negotiation, latency sampling, deep-link restoration, AFK and bot-autopilot state |
| Privacy boundary | Separate public room and per-player private envelopes | Keep every new secret field private-by-construction and add projection tests |
| Core flow | Lobby, role reveal, clue turns, discussion, voting, accusation, Mole guess, reveal, scoreboard, match complete | Insert optional defence/revote and recap stages without changing Classic defaults |
| Settings | Five presets and a typed Zod settings schema | Expand to all requested presets and grouped/searchable settings with dependency enforcement |
| Clues | Spoken and typed clue paths, ordering, skipping, server length checks | Generalize clue payloads for anonymous, emoji, and compact vector drawing modes |
| Voting/scoring | Server-side vote resolution, ties, Mole guessing, scoring and winners | Add confidence, reveal policies, defence/revote, awards, timeline and rematch variants |
| Bots | Server-owned bot seats, difficulty, hidden minds, personalities, deterministic fallback, optional AI clue refinement | Add visible personality controls, renaming, quick fill, autopilot takeover and fair practice/offline use |
| Spectators/TV | Spectator seats and a display route | Add prediction/audience participation, TV lobby polish and remote-focused controls |
| Content | 800+ curated words, category metadata, aliases, difficulty, tags and Canada/Internet categories | Add content-level filters, richer pack metadata, modular dated culture packs and import/export validation |
| Offline/PWA | Installable PWA shell and local pass-the-phone mode | Expand offline gameplay, polite install education and offline/cached capability reporting |
| Safety/retention | Input schemas, rate limits, security headers, no accounts, short room expiry | Add feature kill switches, drawing limits, blacklist/duplicate controls, abuse throttles and safe support codes |
| Testing/docs | Unit, integration, Playwright mobile/desktop, load harness, architecture/security/deployment docs | Expand protocol, privacy, feature flag, state transition, drawing, spectator, bot and visual matrices |

## Needs extension

| Requirement group | Existing overlap | Required extension |
| --- | --- | --- |
| Protocol compatibility | Numeric envelope version | Advertise app version and supported protocol range; reject incompatible clients with refresh/rejoin guidance |
| Presets | Classic, Online, Party, Big Group, Custom | Quick, Family, Chaos, Sweaty; immutable preset definitions; modified-preset summary |
| Host settings | Basic modal and timer dock | Progressive disclosure, search, dependencies, dangerous-action confirmation, config summary and smart suggestions |
| Round flow | Fixed linear state machine | Optional defence and revote, configurable vote reveal, dramatic Mole guess and round recap |
| Rematch | Reset scores and return to lobby | Same settings, reset scores, and return-to-settings choices |
| Bots | Difficulty and internal random personalities | Host-visible personalities, rename, quick fill, AFK seat takeover, human reclaim and offline/practice parity |
| Word selection | Category/family/difficulty metadata and recent IDs | Difficulty/content filters, blacklist, singular/duplicate detection, stronger recent-word avoidance and Mole fairness |
| Custom words | Room-local list | Crowd submission, validation, export/import and share-link payloads with size/version controls |
| Spectators | Read-only room view | Server-closed predictions, audience reactions, privacy-safe aggregate reveal and kill switch |
| Device capability | PWA and reconnect | Network quality, Wake Lock, install education, native invite/share fallbacks and deep-link rejoin |
| Accessibility | Reduced-motion media query and responsive layouts | Quick settings, scalable type, contrast, non-colour symbols, explicit haptic/sound controls and focus/live-region audit |
| Operations | Health endpoint and aggregate console metrics | Game Health panel, sanitized support code, What’s New/changelog and remote feature lifecycle/kill switches |

## Missing

| Area | Missing capabilities |
| --- | --- |
| Feature operations | Central lifecycle registry (`development`, `beta`, `production`, `disabled`) and server-enforced remote kill switches for AI, chat, custom packs, drawing, spectator predictions, external sharing, cosmetics |
| New clue modes | Anonymous reveal, emoji-only validation, vector drawing surface, forbidden clue words and per-player private Mole notebook |
| Voting drama | Confidence selection, incremental/all-at-once/anonymous reveal, defence timer, optional revote and secret reactions |
| Replayability | Chaos modifiers, match timeline, round recaps, awards, session stats and device-only career stats |
| Party systems | Host-phone TV remote affordances, lobby icebreakers, ready cue, room themes, mascot state reactions, seasonal cosmetics and Easter eggs |
| Learning | Contextual first-use tutorial, practice mode and interactive rules demo |
| Localization | String-key foundation and Canadian French locale |
| Diagnostics | Safe capability/latency/build view, copyable support code and privacy-safe health summary |
| Discovery | Contextual feature prompts, advanced settings search and What’s New surface |

## Overlap and consolidation decisions

| Overlap | Decision |
| --- | --- |
| “Big Group” preset and large-group UI | One preset activates density-aware UI; layout behavior remains automatic by seat count |
| Spectator predictions and audience mode | One audience feature family with independent prediction/reaction switches and one server kill switch |
| Secret reactions and audience reactions | One bounded reaction protocol; player reactions may remain private until reveal while audience reactions are aggregated |
| Match timeline, round recap, awards and stats | One persisted, bounded `history` model drives all four views; device career totals are derived and stored locally only |
| Custom packs, crowd packs, import/export and links | One validated `CustomPack` schema with several controlled input channels |
| Network quality, diagnostics and support code | One client diagnostics collector; support codes contain only sanitized capability/status fields |
| Feature flags and What’s New | One central feature registry supplies lifecycle labels, release notes and kill-switch status |
| Practice, pass-the-phone and bots | Shared offline/practice rules and word-selection helpers; online bots stay server-owned |
| Sound, haptics, ready cues and accessibility | One device-preference layer with explicit user consent and reduced-motion overrides |

## Delivery order and compatibility constraints

1. Add version negotiation, normalized persisted-state loading, feature registry and kill switches.
2. Expand schemas/state machine/presets while keeping all new rules opt-in.
3. Add clue, defence, vote and recap protocols with strict private/public projections.
4. Add replayability views, audience systems, bot controls and content tooling.
5. Add offline/PWA, accessibility, localization, diagnostics and discovery polish.
6. Run unit, protocol/privacy integration, browser/visual, load and live smoke checks before production.

The independent comprehensive security/penetration audit requested for a later engagement is intentionally out of scope. This release still requires security regression tests for every new server action and projection.
