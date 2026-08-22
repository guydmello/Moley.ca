# Security and privacy

## Trust boundary

Browsers are untrusted. A participant can modify JavaScript, local state, WebSocket frames, and rendered HTML without gaining an authoritative capability. The Durable Object accepts only schema-valid, stage-valid, permission-valid events tied to the socket’s reconnect token.

## Controls

| Threat | Control |
| --- | --- |
| Change local score or role | Scores and roles exist only in room state; client values are never accepted |
| Read another player’s word | Per-socket allowlist serialization; Mole and spectator envelopes omit the word |
| Forge host action | Host flag resolved from socket attachment; room code is not authorization |
| Vote twice or self-vote | One stored vote per seat, stage check, target validation, self-target rejection |
| Replay an event | Random event ID plus rolling deduplication set and client sequence |
| Hijack a seat | 192-bit URL-safe reconnect token; names do not resume seats |
| Two active tabs | Both attach to one seat; disconnect logic checks other open sockets |
| XSS in names/chat/words | Unicode normalization, control-character stripping, max lengths, React text rendering, no dangerous HTML |
| Huge/malformed payload | HTTP and WebSocket size caps, JSON failure handling, Zod schemas |
| Message spam | Per-seat sliding window; IP-based create/join limits |
| Room-code guessing | Rooms unlisted, create/join throttled, host authority held by private token |
| Timer/client-clock changes | Server timestamps and Durable Object alarms are authoritative |
| AI secret leak | Server-only AI, output validation, secret/alias rejection, single retry policy and deterministic fallback |

The Worker adds a restrictive Content Security Policy, denies framing and high-risk browser permissions, disables MIME sniffing, and uses a strict referrer policy. No credentials are shipped to the client.

## Information allowlists

`publicState()` builds a new public object field by field. `privateState(player)` adds only that player’s permitted secret. The implementation does not serialize internal state and remove secrets afterward. Role-ready progress is aggregate-only so timing does not identify a Mole. Votes remain aggregate-only until the accusation is resolved.

## Data minimization

Moley stores no accounts or contact details. Operational logs contain anonymous room lifecycle dimensions, not reconnect tokens, vote contents, or chat transcripts. Room state is isolated per Durable Object. A production cleanup job should delete completed rooms after 24 hours of inactivity and abandoned lobbies after two hours; alarms already remove expired disconnected seats.

## Pre-launch adversarial check

The automated core tests cover illegal transitions, scoring boundaries, tie cutoffs, normalized aliases, co-winners, and word uniqueness. Protocol schemas reject unknown/malformed action shapes. Before a DNS cutover, run the multi-client browser suite and load harness against the deployed preview, then repeat these manual probes in browser developer tools:

1. Edit a displayed score/role and verify the next snapshot restores it.
2. Send a host event from a non-host socket and verify rejection.
3. Replay the same event ID and verify no second mutation.
4. Submit a second vote, a self-vote, and a spectator vote.
5. Inspect innocent, Mole, and display frames for forbidden fields.
6. Join using `<script>alert(1)</script>` and confirm it renders only as text or is normalized.
7. Send a payload above 4 KB and a malformed JSON frame.
8. Open one seat in two tabs, close one, and verify the seat stays connected.
9. Create/join rapidly and verify friendly 429 responses.
10. Lock the room and verify new players cannot take active seats.

Record date, deployment SHA, browser versions, and outcome for the release checklist. Do not claim a production penetration test from local unit coverage.
