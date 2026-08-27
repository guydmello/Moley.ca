# Moley full feature map

Audit date: 2026-08-27
Discovery baseline: Moley 2.6.0; release target: Moley 2.7.0 / protocol 3
Scope: web client, local engine, shared protocol, word packs, Cloudflare Worker, Durable Objects, service worker, tests, and current product documentation.

## Architecture map

```text
Home / routing / install / accessibility
  apps/web/src/App.tsx, UtilityMenu.tsx, store.ts
        |
        +-- Online authority ----------------------------------------------+
        |   HTTPS create/join + versioned WebSocket                       |
        |   apps/worker/src/index.ts                                      |
        |       -> AbuseGate (durable network limits)                     |
        |       -> GameRoom Durable Object (canonical room snapshot)      |
        |          roles / turns / clues / chat / votes / guesses         |
        |          scoring / timers / bots / history / reconnect          |
        |          -> public projection + one private seat envelope       |
        |                                                                 |
        +-- Local authority -----------------------------------------------+
            LocalPlay.tsx -> @moley/game-core/local
            roles / board / turns / clues / votes / guesses / scoring
            -> IndexedDB + encoded localStorage write-ahead recovery

Shared packages
  @moley/shared      schemas, protocol, settings, public/private types
  @moley/game-core   roles, voting, scoring, bot reasoning, local engine
  @moley/word-packs  canonical words, metadata, categories, bot clues
```

Online and local intentionally have different authorities and transports. Rules, board creation, validation, turn fairness, scoring, and deterministic bot reasoning should live in shared packages.

## Status vocabulary

- **Exists**: implemented and reachable.
- **Partial**: useful implementation exists but coverage or consistency is incomplete.
- **Absent**: not currently a product feature; no UI is advertised.
- **N/A**: the presentation or actor cannot meaningfully support the feature.

## Complete product feature map

| Feature | Exists | Mode availability | Online | Offline/local | TV/public display | Bots | Mobile | Accessibility | Security considerations | Automated tests | Known inconsistency | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landing, create, join | Yes | Home | Yes | Local entry | N/A | N/A | Yes | Semantic controls; Axe home scan | POST Origin/content-type/body limits; unlisted room | `home`, `security`, HTTP integration | None found | Four-word terminology fixed; simple Create -> Join -> Play preserved |
| Local Play / Pass the Phone | Yes | `/local`, `/pass-the-phone` | N/A | Yes | Yes | Yes | Yes | Private handoff, labelled inputs | Device-only save; casual visual privacy | `offline`, `local-devices`, `local-tv`, local unit tests | None found | Duplicate legacy implementation removed; both routes use one engine |
| Practice | No | None | Absent | Absent | N/A | N/A | N/A | N/A | N/A | None | Mentioned in earlier planning, not shipped or advertised | Keep out of Classic; document as future product work |
| How to Play / tutorial | Yes | Home, `/how-to-play`, utility | Yes | Yes | Readable | Explains bots lightly | Yes | Keyboard reachable; Axe rules scan | No private data | `home`, `accessibility` | None found | Board, fair order, mandatory guess, and local TV privacy explained |
| PWA install/update | Yes | Utility + service worker | Shell only | Yes after cache | Local display after cache | Yes | Yes | Native prompt remains optional | `/api` denylist; no runtime API cache | `offline` | Update state is automatic but not prominently announced | Retain safe auto-update and test caches |
| Themes/cosmetics | Yes | Online rooms + home preference | Yes | Home shell only | Yes online | N/A | Yes | High contrast/reduced motion available | Visual only | Replayability smoke | Local game ignores online theme setting | Treat as presentation-only; no rules impact |
| Room creation/join/QR/code | Yes | Online | Yes | N/A | TV joins as spectator | N/A | Yes | Labels and QR text fallback | Durable rate limit, cryptographic code, uniform probe | Multiplayer/security/integration | Four-word code is called three-word in UI/docs | Fix terminology |
| Reconnect/session recovery | Yes | Online + local | Yes | IndexedDB/local fallback with schema migration | Online and local display reconnect/reload | Autopilot optional | Yes | Product-language status | Token only in WS subprotocol/localStorage; one active socket | Multiplayer/protocol/security/offline/local TV | None found | Local v1→v2 migration and explicit display recovery added |
| Host transfer | Yes | Online | Yes | One local authority | Display cannot host | Bots cannot host | Yes | Public notification | Token-bound host capability; grace timer | Multiplayer/security | WebKit timing can be flaky under CI | Keep; extend race regression coverage |
| Spectators/audience | Yes | Online | Yes | N/A | Explicit read-only online display capability | N/A | Yes | Prediction select labelled by context | No role/word; predictions private until reveal; display cannot act | Security/replayability/multiplayer | None found | Display excluded from roster and receives minimal private state |
| Chat | Yes | Lobby/discussion online | Yes | Around-room speech | Read-only on TV | Contextual bot messages | Yes | Labelled message field | Bounded, rate-limited, React text rendering | Security/load | Local bot discussion and online bot discussion use different paths | Share discussion reasoning |
| Roles / multiple Moles | Yes | Online + local Classic | Yes, 1-20 bounded | One Mole currently | Public state only | Yes | Yes | Role not colour-only | Separate public/private projections | Game-core/security/local | Local is fixed to one Mole | Keep Classic local simple; document multiple-Mole local as unsupported |
| Special roles (Double Agent, Jester, Accomplice, Decoy) | No | None | Absent | Absent | N/A | N/A | N/A | N/A | Scoring/privacy undefined | None | Requested for review but not an existing feature | Do not expose until rules, projections, scoring, and tests are designed |
| Random clue order | Yes | Every current game | Shared fair shuffle | Shared fair shuffle | Mirrors authority | Included | Yes | Ordered rail/list | Persisted per round | Core/local/multiplayer | None found | Exact-repeat prevention and recent-first soft avoidance shared |
| Spoken/typed clues | Yes | Online; local records spoken/text | Yes | Yes | Public only | Yes | Yes | Clear stages, labels | Server validation; local validation needed | E2E/security | Local clue limit and normalization are UI-only | Centralize clue validation |
| Emoji/drawing/anonymous | Yes | Advanced online | Yes | Absent | Sanitized public reveal | Partial typed fallback | Responsive canvas | SVG has role/label; settings keyboard path | Bounded vector schema, no uploads | Schemas/replayability smoke | Not supported by local engine | Mark unsupported locally rather than simulate weak parity |
| Defence/revote/confidence | Yes | Advanced online | Yes | Absent | Public phases | Bots vote; no defence speech | Yes | Symbols supplement colour | Vote hidden until allowed | Protocol/replayability | Local Classic intentionally simpler | N/A for Local Classic unless advanced local rules are added later |
| Voting / tie resolution | Yes | All game modes | Yes | Yes | Aggregate/public only | Yes | Yes | Private handoff locally | Self/target/stage/duplicate validation online | Unit/E2E/security | Local tie selects one random accused; correct for one Mole | Reuse shared vote resolver and validate local transitions |
| Mandatory Mole final guess | Yes | Online + local | Typed/spoken judge | Board selection | Public wait only | Yes | Yes | Clear final-chance screen | Secret not revealed until completion | Unit/E2E/security | None found | Server timer records no-guess; host cannot skip; local uses neutral handoff |
| Classic scoring | Yes | Online + local | Shared `scoreRound` | Shared `scoreRound` | Public result | Included | Yes | Text plus visual treatment | Server/local authority; no client arithmetic online | Game-core/local | Dead legacy PassThePhone had separate incorrect/no-guess flow | Delete legacy implementation; add idempotence assertions |
| Match end/rematch/recap | Yes | Online + local | Full recap/history/rematch variants | Result/score/rematch | Public | Included | Yes | Structured headings | Completed-round secrets only | Replayability/offline | Local lacks recap/timeline/awards and preserve-score choice | Add lightweight local recap and explicit rematch choices |
| Boards 5x5-10x10 | Yes | Online + local | Canonical server board | Canonical local board | Online and local TV use same authority board | Mole candidates and innocent secret | Full phone/laptop/TV matrix | Labelled grid and selectable final-guess cells | Normalized unique; secret included; size independently validated | Core/multiplayer/local TV/device matrix | None found | Shared builder and UI support every size 5–10 |
| Word selection/categories/difficulty | Yes | Online + local | Large library + filters | Large library + category filter | Public category by rule | Restricted/audited locally | Yes | Select controls | Hidden content pools in public projection | Word/core/security | Selection/filter code duplicated; online bots may get unaudited secrets | Share catalog filtering and bot-safe secret policy |
| Board uniqueness | Yes | Online + local | Shared normalized catalog/build | Shared normalized catalog/build | Mirrors authority | Yes | Yes | N/A | Unicode, punctuation, whitespace, and conservative plurals collapse centrally | Core attack tests + device E2E | None found | Exact board capacity and uniqueness enforced independently of UI |
| Custom/crowd packs | Yes | Online + local device pack | Room-scoped | Device-only | Count/public result only | Fallback limited | Yes | Import/export controls | Pools hidden; bounded; expiry with room | Security/codec | Board sufficiency and bot compatibility not centrally validated | Add compatibility validation and shared normalization |
| Deterministic innocent bot clues | Yes | Online + local | Selected at actual turn with shared used/history memory | Same shared policy | Public clue only | Yes | N/A | Bot clearly labelled | Innocent bot only receives word; curated fallback for custom-only packs | Bot/local/stress tests | None found | Coordinated unique semantic clues and bounded memory |
| Deterministic Mole deduction/guess | Yes | Online + local | Shared candidate mind and difficulty-weighted guess | Shared candidate mind and guess | Public outputs only | Yes | N/A | N/A | Function accepts candidates/mind/difficulty/random only, never answer | Core/local/security tests | None found | Online and local share the no-cheating candidate engine |
| Bot discussion/personality/voting | Yes | Online + local | Shared state-derived discussion | Shared state-derived discussion | Read-only | Yes | N/A | Bot label | No privileged Mole state | Local 50-round stress + core tests | None found | Shared discussion generator and public-clue-driven suspicion |
| Workers AI enhancement | Yes, optional | Online only | Clue refinement | Disabled/not called | Output only | Fallback guaranteed | N/A | N/A | Server only, timeout/circuit breaker/validation | AI fallback integration | Correctly not required | Preserve as optional enhancement only |
| Chaos modifiers | Yes | Advanced online | Yes | Absent | Public announcement | Included | Yes | Text announcement | Server chooses/applies | Replayability smoke | Some modifiers are labels with minimal mechanical effect | Validate each modifier or remove misleading ones |
| Tournaments/events/Moley Lab | No | None | Absent | Absent | N/A | N/A | N/A | N/A | N/A | None | Mentioned as review targets, not current product | Keep N/A; do not bloat initial bundle |
| Public/TV display | Yes | Online + local | Explicit sanitized read-only display | Session-scoped local public projection | Attach/reload/detach/reopen | Public bot outputs | Responsive | Large-screen layout and stale-host state | Strict allowlists; no authority snapshot | Security/multiplayer/local-TV/device tests | None found | Online and local displays share public-state principles |
| Private/Pass/Public routing | Yes | Local + online projections | Role-specific private envelope | Typed visibility and role/vote/guess handoffs | Explicit public projection | N/A | Yes | Neutral handoff | UI-only reveal state not persisted; CSS privacy gate | Offline/local-TV/security | None found | All local private stages derive explicit visibility metadata |
| Settings/presets/smart defaults | Partial | Online + local separate preset sets | Rich/searchable | Focused local setup | Public summary | Difficulty controls | Yes | Dialog focus trap | Server validates rich settings | Accessibility/replayability | Names/terminology and compatibility rules are split | Add central configuration validation; retain mode-appropriate settings |
| Persistence/migrations | Yes | Online + local | Durable snapshot normalization | IndexedDB + fallback + v1→v2 migration | Online/local display recovery | Bot mind persisted | Yes | Recovery language | Bounded room retention; local stays local; invalid saves fail closed | Protocol/offline/local unit | None found | Explicit local schema and structural validation added |
| Protocol/version compatibility | Yes | Online | Protocol 3 exact range | Local schema separate | Online display | N/A | Yes | Refresh message | Reject stale/foreign clients | Protocol tests | Version checks sound; local migration missing | Keep protocol; bump only if wire shape changes |
| Service worker/offline cache | Yes | Platform | Shell cache only | Full local launch | Local display route precached with shared app shell | Yes | Yes | Install state | API denylist; no private network cache | Offline + local-TV E2E | None found | Fresh-build E2E verifies production service worker assets |
| Accessibility controls | Yes, partial | Global utility | Yes | Utility absent inside active local game | Online display passive | N/A | Yes | Scale/contrast/reduced motion; Axe | No sensitive support code fields | Accessibility | Modal utility panel is not a true dialog; local stages need dedicated Axe scans | Add labels/live regions and expanded stage scans |
| Responsive/device support | Yes | All current pages | Phone-desktop-TV CSS | Full required matrix | Online/local display CSS | N/A | Yes | Reflow/scroll | N/A | 14 required viewports + 18 board/form-factor combinations | None found in emulation | Physical hardware remains a documented manual gate |
| Diagnostics/analytics | Yes | Utility/server logs | Health/config/latency | Device stats | Public display status | Aggregate | Yes | Human-readable | Support code excludes private fields | Runtime/config tests | No invasive analytics by design | Retain privacy-safe operational telemetry |
| Error handling/navigation | Partial | All | Product messages/reconnect | Recovery and Back/Forward privacy | Display error route | Fallbacks | Yes | Alerts/status | No raw client stacks | E2E | Prompt/confirm and some silent import/save failures reduce clarity | Improve only high-value paths; add deep-link/navigation tests |
| Rate limits/input validation | Yes, partial | Network inputs | Durable + room/player limits | Engine guards needed | Spectator limits | Server-owned | N/A | Product errors | Zod/body/origin/frame bounds | Security/integration/load | One generic per-seat event bucket; local settings lack schema | Centralize configuration/board/clue validation and add fuzz tests |

## Sensitive-data inventory summary

The detailed lifecycle is maintained in `docs/private-data-inventory.md`. The strict boundaries discovered here are:

- Online secret word, unrevealed roles, guesses, notes, individual votes, reconnect tokens, crowd words, and pre-close predictions live only in the Durable Object/private seat envelope until their defined reveal stage.
- The online public/display projection receives no custom/category pools, reconnect tokens, private notes, word before reveal, or role assignments.
- Local full authority state necessarily lives on the game device. Private reveal visibility is not persisted. Any external local display must receive a new allowlisted public projection rather than the local authority object.

## Inconsistency and risk list

### Release-blocking convergence work

All eight discovered blockers were resolved: one shared normalized board engine; online canonical boards; shared fair turn ordering; unique candidate-aware bots; local public-display transport; typed Private/Pass/Public routing; local save migration/validation; and removal of the duplicate PassThePhone engine.

### Important polish and assurance work

Terminology, compatibility validation, projection/fuzz/idempotency/bot/device/navigation/accessibility coverage, and explicit `N/A` handling for non-features were completed. Physical-device and real-human social testing remain release observations, not application defects.

## Phased improvement plan

1. **Shared core:** normalized word keys, board generation, catalog filtering, configuration validation, fair order, scoring idempotence guards, and unified deterministic bot helpers.
2. **Online parity:** settings and canonical board persistence/projection; shared board presentation; improved bot clue/deduction path.
3. **Local/display:** explicit visibility, sanitized local public projection, BroadcastChannel/local snapshot display, mid-match attach/reload/detach handling, guess privacy, migrations, and duplicate-code removal.
4. **Polish/security:** terminology, validation messages, accessible labels/live regions, input/race/projection hardening, and lazy-load preservation.
5. **Verification:** unit, integration, security/fuzz, full E2E, every board size across phone/laptop/TV, full viewport matrix, offline multi-window, load, and production smoke.

## Discovery decision record

- Classic remains the default low-friction online experience. Online Board Play is an explicit setting/preset capability rather than mandatory visual noise.
- Local Classic remains one-Mole Classic. Advanced roles are not simulated until their rules and privacy model exist.
- Local TV is a presentation layer over local authority. It never becomes a second engine and never receives the authority snapshot.
- Optional Workers AI remains an enhancement; deterministic bots are the correctness baseline in every supported mode.
- Features with no implementation (special roles, tournaments, events, Moley Lab) are reported as absent/N/A, not falsely marked PASS.
