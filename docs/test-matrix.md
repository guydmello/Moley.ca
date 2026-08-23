# Final test matrix

Executed 2026-08-23 unless noted. `PASS` means the stated check actually ran. `NOT RUN` is deliberately not treated as a pass.

## Automated quality and security

| Scenario | Environment | Status | Evidence |
| --- | --- | --- | --- |
| TypeScript all workspaces | Node 22/local | PASS | `npm run typecheck` |
| ESLint, zero warnings | Local | PASS | `npm run lint` |
| Unit/integration | Vitest | PASS | 6 files, 34 tests |
| Production web/Worker build | Vite/Wrangler dry run | PASS | Bounded chunks; GameRoom + AbuseGate bindings |
| Dependency audit | npm registry | PASS | 0 vulnerabilities |
| Secret projection | Live local Worker | PASS | One-word custom pack absent for Mole/spectator, exact for innocent |
| Host escalation | Live local Worker | PASS | Non-host `host_add_bot` rejected |
| Stale sequence | Live local Worker | PASS | Lower sequence rejected |
| Host/player reconnect | Multi-context E2E | PASS | Seat restored; host transfer after grace |
| Cross-site/Content-Type/malformed/oversized HTTP | Live local Worker | PASS | 403/415/400/413 |
| Room enumeration | Live local Worker | PASS | Uniform 405 |
| Hostile Zod/prototype inputs | Vitest | PASS | NaN, Infinity, prototype keys, wrong types rejected |
| Unicode custom-pack link | Vitest | PASS | Unicode round trip; malformed/overlong rejected |
| Offline pass-the-phone | Production PWA locally | PASS | Offline reload/start; API responses absent from Cache Storage |
| Accessibility | Axe + keyboard E2E | PASS | Home, rules, pass-phone; modal focus/Escape/restore |

## Browser and viewport coverage

| Scenario | Engine/device emulation | Status |
| --- | --- | --- |
| Core create/join/private roles/reconnect | Desktop Chromium | PASS |
| Core create/join/private roles/reconnect | Mobile Chromium | PASS |
| Core create/join/private roles/reconnect | Firefox | PASS |
| Core create/join/private roles/reconnect | Desktop WebKit | PASS |
| Core create/join/private roles/reconnect | iOS WebKit emulation | PASS |
| Public screens | 320×800, 360×800, 375×667, 390×844, 412×915, 430×932 | PASS |
| Landscape/tablet | 667×375, 768×1024, 1024×768 | PASS |
| Desktop/TV | 1366×768, 1440×900, 1920×1080, 2560×1440, 3840×2160 | PASS |
| Physical Safari/iPhone/iPad | Real hardware | NOT RUN |
| Physical Android Chrome/foldable | Real hardware | NOT RUN |
| Microsoft Edge | Real Edge binary | NOT RUN; Chromium engine covered |

## Controlled local load tests

| Scenario | Result | Status |
| --- | --- | --- |
| One 100-player room | 4,458 ms connect; heartbeat p95 105 ms; 0 missing | PASS |
| 100 rooms × 8 = 800 sockets | slowest room 2,367 ms; worst p95 975 ms; 0 missing | PASS |
| 50 rooms × 20 = 1,000 sockets | slowest room 3,326 ms; worst p95 1,325 ms; 0 missing | PASS |
| 4 players + 196 spectators | 6,397 ms connect; p95 2,681 ms; 0 missing | PASS |
| 100-seat reconnect replacement storm | initial connect 4,501 ms; p95 38 ms; all replacements opened | PASS |
| 40-seat simultaneous vote burst | 1,339 ms connect; p95 9 ms; 0 missing | PASS |
| 40-seat chat burst | 1,354 ms connect; p95 10 ms; 0 missing | PASS |
| Cloudflare production 1,000-user destructive load | Production | NOT RUN by safety policy |

Local load results validate the code path and harness, not Cloudflare account capacity, CPU, or memory limits.

## Product/manual scenarios

| Scenario | Status | Notes |
| --- | --- | --- |
| Mixed game: 2 humans + 2 bots | PASS | Automated create/join/start/private roles/reconnect |
| Pass-the-phone role privacy | PASS | Automated handoff/reveal and offline start |
| Settings/presets discoverability | PASS | Automated searchable settings and lifecycle config |
| Custom pack confidentiality | PASS | Live one-word pack boundary test |
| Classic 4 physical humans, full match | NOT RUN | Needs four real participants/devices |
| Eight remote typed players, full match | NOT RUN | Needs coordinated real users |
| TV + phones full match | NOT RUN | Layout and spectator boundary tested; real TV session not run |
| 20+ player real social session | NOT RUN | Socket load tested; social pacing not tested |
| Drawing full match/rematch/chaos/multiple Moles | NOT RUN | Server schemas/features reviewed; no complete UI match automation |
| VoiceOver/TalkBack/NVDA/JAWS | NOT RUN | Axe/keyboard is not a screen-reader substitute |
| Audio/haptics/wake lock on hardware | NOT RUN | Requires user gesture and physical devices |

## Production release gates

| Gate | Status |
| --- | --- |
| Cloudflare account authenticated and zone Active | PASS |
| DNS Worker routes, TLS, HTTPS settings inspected | PASS |
| GitHub CI for final commit | PENDING DEPLOYMENT |
| Live 2.5.0 `/api/config` and `/api/health` | PENDING DEPLOYMENT |
| Live headers, apex, `www` redirect, create/join/reconnect | PENDING DEPLOYMENT |
| Mail DNS decision | OPEN |
