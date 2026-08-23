# Final security summary

Date: 2026-08-23  
Candidate: 2.5.0 / protocol 3

## Result

The release candidate has no known open Critical or High application-security finding. The critical secret-word projection bug and the high-risk reconnect-token, room-enumeration, Origin, durable-rate-limit, and heartbeat-amplification issues were fixed and regression-tested.

This was an authorized source review plus controlled local dynamic test. It was not an independent third-party penetration test and did not run destructive load against Cloudflare production.

## Controls verified

| Boundary | Verification |
| --- | --- |
| Secret word | Mole and spectator snapshots do not contain the word or custom/category pools; innocent snapshot receives the exact word. |
| Host authority | Non-host host action rejected; host status comes from the authenticated socket seat. |
| Session | 192-bit token stays out of URL; invalid/missing protocol and foreign Origin fail; second socket replaces first. |
| Voting/state | Schema, role, target, self-vote, duplicate vote, stage, and sequence controls are server-side. |
| Input | Bounded Zod schemas, control/bidi stripping, React text rendering, no dangerous HTML, early HTTP/body/frame limits. |
| Abuse | Durable network throttles, room join throttle, player/spectator caps, action/chat/drawing/crowd rates. |
| Browser | Production CSP, HSTS, frame denial, no-sniff, COOP/CORP, restrictive permissions/referrer policy. |
| Storage | No account/contact data; bounded chat/history; secrets excluded from logs and caches; inactive-room alarms delete storage. |
| Supply chain | `npm audit --omit=dev`: 0 vulnerabilities; tracked source/history secret-pattern review found no credential value. |

## Cloudflare review

- Zone `moley.ca`: Active, Free plan.
- Apex and `www`: proxied Worker custom domains.
- Managed certificates: Active for apex/wildcard/`www`.
- Always Use HTTPS: enabled; minimum TLS: 1.2; TLS 1.3: enabled.
- Custom WAF rules: 0/5; Cloudflare rate limiting rules: 0/1; application Durable Objects provide the release's abuse controls.
- DNS contains only Worker apex/`www` and `_domainconnect`; mail authentication/receiving records are absent.

## Residual risks

- A room invitation is intentionally a bearer invitation, not authentication. Entropy and throttles reduce guessing; players should still avoid posting active codes publicly.
- Reconnect tokens are stored in origin-local browser storage so reload/reconnect works. XSS prevention and CSP are therefore important; no third-party scripts are loaded.
- `style-src 'unsafe-inline'` remains because current React styling uses inline style attributes. `unsafe-eval` is not permitted.
- Free-plan Cloudflare managed WAF rules are not configured; monitor Worker 4xx/5xx and abuse metrics and consider Turnstile or an edge rate rule if attacks appear.
- Physical-device screen reader, colour-blind user, real-party social, and target-account 1,000-user capacity tests remain manual gates.
- Mail DNS must be decided before claiming that `@moley.ca` addresses work or are spoof-resistant.
