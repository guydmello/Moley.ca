# Current test matrix

The complete Moley 2.7 feature-by-mode/device/actor/security matrix is maintained in [`full-system-test-matrix.md`](./full-system-test-matrix.md). It contains no blank cells and uses only `PASS`, `FAIL`, and `N/A` statuses.

Latest local release evidence, 2026-08-27:

| Gate | Status | Evidence |
| --- | --- | --- |
| TypeScript | PASS | All five workspaces |
| ESLint | PASS | Zero warnings |
| Unit/integration | PASS | 7 files, 75 tests |
| Production build | PASS | Vite assets + Wrangler dry-run, 728.92 KiB raw / 129.93 KiB gzip Worker upload |
| Browser E2E | PASS | 48 executed, 67 intentional project skips, 115 project cases |
| Browser engines | PASS | Mobile Chromium, desktop Chromium, Firefox, desktop WebKit, iOS WebKit emulation |
| Explicit viewports | PASS | 14 required phone/tablet/laptop/desktop/TV viewports |
| Board layouts | PASS | 5×5–10×10 on phone, laptop, and TV; 18 layouts |
| Offline production PWA | PASS | Network disabled; complete match, persistence, rematch, no cached API responses |
| Online + local TV | PASS | Canonical board, reload/reconnect, public-only raw state |
| Security | PASS | Host/role/display boundaries, audience privacy, malformed/stale input, invalid token, room-probe controls |
| Controlled local load | PASS | 100-seat fanout/reconnect and 40-seat simultaneous votes, zero missing heartbeats |
| Dependency audit | PASS | 687 packages, 0 vulnerabilities |
| Physical device and real-human observation | N/A | Not represented as automated evidence |
| Destructive production load / third-party penetration test | N/A | Not performed |

Deployment and production smoke results are added to the full-system report after the release is live.
