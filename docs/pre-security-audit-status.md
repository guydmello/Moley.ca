# Pre-security-audit status

Release candidate: Moley 2.4.0  
Protocol: 2 (supported range 2–2)  
Prepared: 2026-08-23

## Outcome

The major feature and replayability upgrade is implemented as an additive, server-authoritative release. Classic remains the default and retains spoken clues, the original stage rhythm, immediate post-vote resolution and original scoring unless a host deliberately changes an advanced setting.

This document closes the feature-expansion run and is the handoff point for the separately requested comprehensive security/penetration audit. That independent audit has not been performed here.

## Phase status

| Phase | Status | Evidence |
| --- | --- | --- |
| 1. Audit and safe release foundation | Complete | `feature-expansion-audit.md`; app/protocol compatibility; v1 snapshot normalization; lifecycle flags; Worker kill switches |
| 2. Presets and setup | Complete | Nine presets; searchable grouped settings; dependencies; modified-preset and final configuration summaries |
| 3. Round flow and rematches | Complete | Optional defence/revote, three rematch choices, operational Chaos modifiers |
| 4. Clue replayability | Complete | Spoken, typed, emoji, drawing and anonymous modes; forbidden words; private notebook |
| 5. Voting and recap | Complete | Confidence, configurable reveal, reactions, round recap, bounded timeline, awards and result cards |
| 6. Audience, host and bots | Complete | Predictions/reactions, TV/public view, host remote controls, confirmations, AFK autopilot/reclaim, personality/rename/quick-fill |
| 7. Content and packs | Complete | Difficulty/content filters, expanded Canada, dated culture metadata, custom import/export/links, crowd packs, duplicate/blacklist/recent-word controls |
| 8. Offline and device | Complete | Cached PWA, pass-the-phone/practice path, network quality, Wake Lock, install prompt, deep-link rejoin and native invite/share fallback |
| 9. Learning, localization and accessibility | Complete with beta locale | Contextual first-use tutorial/rules demo, i18n key foundation, partial Canadian French beta, quick accessibility controls and non-colour player symbols |
| 10. Operations and discovery | Complete | Mascot moods, themes/seasonal cosmetics/easter egg, Game Health, sanitized support codes, What’s New, changelog and discovery/search UI |

## Authority and privacy review

- The Durable Object remains authoritative for settings, stages, roles, words, clue payloads, votes, timers, predictions, reactions, bot actions, scoring and history.
- Drawing input contains normalized vector strokes only. There is no file/image upload endpoint. Stroke count, point count, coordinate, width, colour and message-size limits are validated.
- Notebooks are included only in their owner’s private projection.
- Predictions are accepted only from spectators during allowed stages and reveal only as aggregate totals after the round.
- Anonymous clue projections do not include the player identifier alongside clue content.
- Reactions are bounded and reveal as aggregates.
- Career statistics are device-only local storage.
- Support codes omit room codes, tokens, names, identifiers, chat, clue text, roles, votes and secret words.
- Feature controls are rechecked on Worker traffic. Killed features reject corresponding server events even from a manually modified client.
- Completed history is bounded to 24 rounds; rooms retain the existing two-hour lobby, six-hour active and twenty-four-hour completed-match expiry policy.

## Verification completed

### Static, unit and build

- TypeScript: all workspaces passed.
- ESLint: passed with zero warnings.
- Vitest: 6 files, 30 tests passed.
- Production Vite build: passed; drawing and expanded settings ship as lazy chunks.
- Worker dry run: completed with the existing harmless sandbox-only Wrangler log-file permission warning; bundle and bindings were produced.

### Browser and visual

- Existing mobile and desktop suite: 8 passed, 2 expected WebKit visual-only skips.
- New replayability/config suite: 4 passed across mobile and desktop.
- Covered routes and screens include home, rules, offline pass-the-phone, lobby, private role reveal, create/join, reconnect/host transfer, preset discovery, settings search, public compatibility config and supported review widths.

### Load

- 100-seat local fanout: passed; all 100 WebSockets connected in 4.4 seconds in the local harness.
- 40-seat simultaneous-vote scenario: passed; all seats connected in 1.3 seconds before the burst.

## Release configuration

Public lifecycle defaults:

- Production: AI, chat, external sharing, device-only career stats
- Beta: custom packs, drawing, spectator predictions, cosmetics, Chaos, audience participation, Canadian French
- Emergency controls: `KILL_AI`, `KILL_CHAT`, `KILL_CUSTOM_PACKS`, `KILL_DRAWING`, `KILL_SPECTATOR_PREDICTIONS`, `KILL_EXTERNAL_SHARING`, `KILL_COSMETICS`

## Production deployment

- Cloudflare Worker deployment succeeded on 2026-08-23.
- Version ID: `c5bfb482-8fb2-4605-b117-06d58792b68d`
- Live origins: `https://moley.ca`, `https://www.moley.ca`, and `https://moley.guyrdmello.workers.dev`
- Apex and preview returned HTTP 200; `www` returned the canonical 301 to the apex.
- `/api/health` returned app 2.4.0 and protocol range 2–2.
- `/api/config` returned the expected public flags and release notes.
- A standards-complete protocol-v1 WebSocket handshake returned HTTP 426 with `CLIENT_UPDATE_REQUIRED`, range 2–2, and refresh guidance.
- Live Chrome smoke: 3/3 passed for create/join, bots, private roles, refresh/reconnect, host transfer, new preset/settings discovery and runtime compatibility.
- Live response headers include CSP, HSTS, `nosniff`, referrer policy and restrictive camera/microphone/geolocation policy.

## Known non-blocking limitations

- Canadian French is deliberately labelled beta: the locale system and utility/accessibility surface are ready, but the complete long-form game copy remains English-first.
- Workers AI remains optional. A killed, unavailable, timed-out or invalid AI response uses deterministic bot behavior.
- Browser install and file-share affordances depend on platform support and user gesture; copy/download fallbacks remain available.
- Cloudflare account-level limits remain external to the product’s own large-room layout and load-tested behavior.

## Next engagement

Perform the independent comprehensive security and penetration audit against the deployed 2.4.0 production build, including adversarial protocol fuzzing, Durable Object authorization, projection leakage, CSP bypass attempts, kill-switch bypass, drawing payload abuse, custom-pack abuse, reconnect/session theft scenarios and Cloudflare configuration review.
