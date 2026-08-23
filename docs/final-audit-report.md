# Moley.ca final pre-launch audit report

## Executive Summary

Moley 2.5.0 is materially safer and more resilient than the initial candidate. One Critical secret-projection issue and five High-risk session, enumeration, rate-limit, Origin, and heartbeat-amplification issues were reproduced and fixed. The local quality gate, 34 unit/integration checks, desktop acceptance suite, four additional browser/device projects, accessibility scans, offline PWA check, and controlled loads through 1,000 sockets pass.

This report does not fake unavailable evidence. Physical-device sessions, real assistive technology, coordinated human games, and destructive production load were not run. The code candidate has no known open Critical or High finding, but final launch approval is conditional on those manual gates, the email-DNS decision, and post-deployment production smoke tests.

## Testing Performed

Source/data-flow review, trust-boundary review, schema fuzz cases, multi-context browser play, live WebSocket adversarial events, hostile HTTP requests, PWA cache/offline behavior, automated accessibility, responsive screenshots, build/lint/type/unit checks, dependency/secret patterns, controlled load, and read-only Cloudflare dashboard/DNS/TLS review.

## Devices Tested

Playwright covered mobile Chromium, iOS WebKit emulation, desktop sizes, tablets, and TV/4K viewports. No claim is made for physical iPhone, Android, foldable, tablet, or television hardware.

## Browsers Tested

Desktop Chromium, mobile Chromium, Firefox, desktop WebKit, and iOS WebKit all passed core user journeys. Real Safari and Edge binaries were not run independently.

## Security Testing

The test found and fixed unauthorized content projection, credential-in-URL handling, room enumeration, non-durable throttling, missing WebSocket Origin checks, active multi-tab duplication, stale client sequences, permissive host actions, malformed input paths, and response-header gaps. Role-separated live tests now assert what each client receives, rather than inferring privacy from UI behavior.

## Multiplayer Testing

Automated multi-context play covers room creation, join, bot fill, role reveal, private projections, reconnect, host disconnect/transfer, and four browser engines. Controlled tests covered 100 players in one room, 800 and 1,000 multi-room sockets, 196 spectators, reconnect replacement, vote bursts, and chat bursts with no missing test heartbeat.

## UX Testing

Primary entry paths, tutorial, settings, pass-the-phone handoff, lobby/role layouts, modal keyboard behavior, forbidden-clue visibility, copy/diagnostics paths, and responsive public screens were checked. Full manual games for every preset/clue mode are still required.

## Accessibility Testing

Automated axe checks report no serious violations on home, rules, or pass-the-phone. Settings focus is trapped, Escape closes, and focus restores. Keyboard automation is not a substitute for VoiceOver, TalkBack, NVDA, or JAWS testing.

## Performance Testing

Production chunks are below the prior 500 KiB warning threshold. Heartbeats no longer write or broadcast snapshots. Local loads reached 1,000 concurrent sockets; worst recorded p95 heartbeat in the tested scenarios was 2,681 ms in the 200-connection audience case, with zero missing. These results do not measure Cloudflare production CPU/memory/account ceilings.

## AI/Bot Testing

AI output validation and deterministic fallback unit checks pass, including an absent AI binding. Bots remain server-side and Moles are never sent the secret word. A prolonged live Workers AI outage and prompt-injection campaign were not executed against production.

## Findings

See `docs/final-audit.md` for severity, resolution, and evidence. See `docs/audit-fixes.md` for implemented changes.

## Residual Risks

- Invitation codes remain bearer invitations by design.
- Reconnect tokens are origin-local bearer credentials.
- Cloudflare Free-plan custom/managed WAF rules are not configured; application-layer throttles are the primary defense.
- Production capacity and prolonged memory behavior require target-account observation.
- Email spoofing/receiving posture is unresolved until the owner confirms whether the domain sends or receives mail.

## Known Limitations

Complete UI matches for all presets, clue modes, multiple Moles, drawing, chaos, TV control, and rematch are not automated. Real social pacing, audio, haptics, wake lock, low-end hardware, colour-blind users, and assistive technology require manual sessions.

## Recommended Monitoring

- Alert on Worker 5xx, Durable Object exceptions, abnormal 429 volume, and reconnect failure rates.
- Track room creation, active room count, round completion, AI fallback, and p95/p99 action latency without content or identifiers.
- Set Workers and Workers AI budget notifications.
- Review Cloudflare security insights and add an edge rate rule or Turnstile only if real abuse warrants it.
- Re-run security, accessibility, cross-browser, offline, and load regressions for every protocol or projection change.

## Final Readiness Assessment

**Code/security candidate: READY WITH MANUAL GATES. Production release: PENDING.**

No known Critical or High code issue remains. Do not describe the full pre-launch audit as complete until the pending production smoke tests pass and the owner either performs or explicitly accepts the listed physical/manual scenarios and resolves the mail-DNS choice.
