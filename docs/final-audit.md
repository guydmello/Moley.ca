# Final pre-launch audit tracker

Audit date: 2026-08-23  
Release candidate: Moley 2.5.0 / protocol 3  
Scope: repository, local Worker/PWA, controlled local adversarial and load tests, Cloudflare account and domain read-only review

Status legend: `PASS` was executed successfully; `FIXED` was reproduced, changed, and regression-tested; `NOT RUN` was not honestly testable in this environment; `OPEN` needs a product or owner decision.

## Findings

| ID | Severity | Finding | Resolution | Evidence |
| --- | --- | --- | --- | --- |
| SEC-01 | Critical | Public room settings exposed custom word/category pools, allowing a Mole to recover or narrow the secret. | FIXED | Role-separated WebSocket regression with a one-word `TOPSECRET` pack. |
| SEC-02 | High | Reconnect tokens appeared in WebSocket query strings and therefore in common proxy/access logs. | FIXED | Protocol 3 subprotocol transport; query token removed; reconnect E2E passes. |
| SEC-03 | High | Room codes had only 1,728 combinations and a public status endpoint disclosed room existence/stage/seat count. | FIXED | Four-word million-plus space test; status probe now returns uniform 405. |
| SEC-04 | High | Create/join limits were process-local and disappeared across isolates. | FIXED | SQLite Durable Object `AbuseGate`, room-level join throttle, early size limits. |
| SEC-05 | High | WebSockets did not validate Origin and multiple tabs could actively control one seat. | FIXED | Foreign Origin rejected; new socket replaces previous seat socket. |
| SEC-06 | Medium | Client sequence numbers were parsed but stale/duplicate sequences were accepted. | FIXED | Per-socket monotonic sequence check and live stale-event regression. |
| PERF-01 | High | Every heartbeat persisted and broadcast a full room snapshot, creating quadratic large-room work. | FIXED | Direct `pong` response; 1,000-socket controlled load run completed with no missing heartbeat. |
| SEC-07 | Medium | Drawing/event limits were either too small for valid drawings or too broad to prevent feature abuse. | FIXED | 128 KiB frame cap; bounded 32-stroke/240-point vector schema; per-action limits and hostile parser tests. |
| SEC-08 | Medium | Host removal/restart/transfer actions were legal in unsafe stages or to unsafe targets. | FIXED | Between-round and connected-human checks enforced server-side. |
| UX-01 | Medium | Settings/share modals lacked complete focus trap, Escape close, and focus restoration. | FIXED | Automated keyboard/focus test and axe scan. |
| A11Y-01 | Medium | Brand/rules colour combinations failed serious contrast checks. | FIXED | Axe scans pass on home, rules, and pass-the-phone. |
| UX-02 | Medium | Forbidden words were delivered privately but not visible to innocent players. | FIXED | Innocent-only clue-screen notice; pools remain absent from public/Mole snapshots. |
| DATA-01 | Medium | Career totals could be incremented repeatedly by rerendering a completed match. | FIXED | Match ID deduplication with bounded local history. |
| PWA-01 | Medium | Offline/PWA privacy needed direct cache verification. | PASS | Production-mode offline reload works; no `/api` responses are stored by service worker. |
| CF-01 | Medium | No Cloudflare custom WAF/rate-limit rule exists. | ACCEPTED | Durable application-level limits protect create/join/action paths; Free-plan dashboard reviewed. |
| DNS-01 | Medium | No MX/SPF/DKIM/DMARC records exist; email usage answer remains ambiguous. | OPEN | Do not change mail DNS until owner confirms whether `@moley.ca` email must work. |
| QA-01 | Medium | Physical-device, assistive-technology, real-party and production-scale capacity sessions are not available to automation here. | OPEN | Listed explicitly as `NOT RUN` in the test matrix; never represented as PASS. |

## Acceptance position

No known Critical or High code finding remains open in the release candidate. Automated checks, cross-browser multi-client play, security regressions, offline PWA checks, responsive screenshots, and controlled local load scenarios pass. Launch approval remains conditional on the physical/manual sessions and email-DNS decision listed above, plus post-deployment live smoke tests.
