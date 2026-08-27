# Moley 2.7 full-system test matrix

Executed: 2026-08-27
Protocol: 3
Status vocabulary: `PASS` means the supported behaviour was exercised by automation or an explicitly listed source/build review. `N/A` means the feature is intentionally unsupported, absent, or the column does not apply. There are no unresolved `FAIL` results. No cell is blank.

Physical hardware and real-human sessions are not represented as automated passes. Phone, tablet, laptop, and TV results below use Playwright browser/device/viewport emulation.

| Feature | Online | Local Offline | One Device | TV | Phone | Tablet | Laptop | Bot | Human | Security | Automated Test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landing / create / join / four-word code | PASS | PASS | PASS | N/A | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| Classic create → join → play | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Presets and searchable settings | PASS | PASS | PASS | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Shared 5×5–10×10 board | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Normalized board uniqueness / crafted duplicates | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Canonical board across reconnects/displays | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Fresh fair clue order each round | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Private role reveal | PASS | PASS | PASS | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Spoken clues | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Typed clues | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Emoji clues | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Drawing clues | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Discussion and online chat | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Secret voting / tie resolution | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Defence / revote / confidence / reveal variants | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Mandatory caught-Mole final guess | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Classic scoring and score-once invariant | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Round recap / scoreboard / match / rematch | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Innocent bot clue quality / uniqueness / memory | PASS | PASS | PASS | PASS | N/A | N/A | N/A | PASS | N/A | PASS | PASS |
| Mole bot candidate reasoning / no-answer boundary | PASS | PASS | PASS | PASS | N/A | N/A | N/A | PASS | N/A | PASS | PASS |
| Mixed humans and bots | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| One human plus bots | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Built-in large word library / filters | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Custom packs | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Crowd-pack submissions | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Chaos modifiers | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Audience predictions / reactions | PASS | N/A | N/A | N/A | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| Ordinary spectator | PASS | N/A | N/A | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| Online read-only TV Display | PASS | N/A | N/A | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS |
| Local TV attach / reload / detach / reopen | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Private / Pass / Public local routing | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Online reconnect and one-active-seat session | PASS | N/A | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Host transfer after disconnect | PASS | N/A | N/A | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| Local persistence and v1→v2 migration | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Offline PWA with backend and AI unavailable | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Navigation: Back / Forward / refresh / deep link | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Themes / contrast / font scale / reduced motion | PASS | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS | N/A | PASS |
| Sound and haptics controls | PASS | PASS | PASS | N/A | PASS | PASS | PASS | N/A | PASS | N/A | PASS |
| Accessibility: Axe / keyboard / focus restoration | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Required 14-viewport responsive matrix | PASS | PASS | PASS | PASS | PASS | PASS | PASS | N/A | PASS | N/A | PASS |
| Input/schema/stage/role validation | PASS | PASS | PASS | PASS | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| Rate limits / body and frame bounds | PASS | N/A | N/A | PASS | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| Projection privacy / recursive public-state audit | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Stale / duplicate / malformed event rollback | PASS | PASS | PASS | PASS | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| Simultaneous-vote load / serialized authority | PASS | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| 100-seat fanout / reconnect storm | PASS | N/A | N/A | PASS | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| Device-only career totals (not achievements) | PASS | PASS | PASS | N/A | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Practice mode | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Special roles / side missions / moderator | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Tournaments / events | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Account-backed achievements | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Moley Lab / replay dashboard | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

## Execution evidence

- `npm run check`: PASS — type checking for all five workspaces, ESLint with zero warnings, 7 Vitest files / 75 tests, Vite production build, and Wrangler Worker dry-run.
- `npm run test:e2e`: PASS — 48 executed / 67 intentional skips across 115 project cases. Projects: mobile Chromium, desktop Chromium, Firefox, desktop WebKit, and iOS WebKit emulation.
- Device matrix: PASS — 360×800, 375×667, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440, TV 1920×1080, TV 3840×2160.
- Board matrix: PASS — every 5×5 through 10×10 size on a 390×844 phone, 1440×900 laptop, and 1920×1080 TV; 18 game layouts.
- Bot/word stress: PASS — 50 bot-heavy offline rounds at 10×10 with 10 bots; 300 sampled production boards; curated semantic-clue coverage.
- Controlled local load: PASS — 100-seat fanout 4,475ms / p95 109ms / 0 missing; 100-seat reconnect storm 4,460ms / p95 106ms / 0 missing; 40-seat simultaneous vote 1,369ms / p95 14ms / 0 missing.
- Dependency audit: PASS — `npm install --package-lock-only --ignore-scripts` reported 0 vulnerabilities across 687 audited packages.

## Manual-only observations

Physical iPhone/iPad/Android/TV hardware, VoiceOver/TalkBack/NVDA/JAWS, real audio/haptic behaviour, and real-party social pacing were not run in this automated environment. Those are honest product-observation gates, not hidden `PASS` results. No destructive production load or independent third-party penetration test was performed.
