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
| Replay an event | Random event ID, rolling deduplication set, and monotonic sequence per socket |
| Hijack a seat | 192-bit URL-safe reconnect token carried outside URLs; names do not resume seats |
| Two active tabs | New socket replaces the prior socket for that seat |
| XSS in names/chat/words | Unicode normalization, control-character stripping, max lengths, React text rendering, no dangerous HTML |
| Huge/malformed payload | Early HTTP and 128 KiB WebSocket size caps, JSON failure handling, Zod schemas |
| Message spam | Durable per-network create/join throttles plus per-seat action/chat/drawing limits |
| Room-code guessing | Four-word million-plus space, uniform status response, throttled join, private-token authority |
| Timer/client-clock changes | Server timestamps and Durable Object alarms are authoritative |
| AI secret leak | Server-only AI, output validation, secret/alias rejection, single retry policy and deterministic fallback |

The Worker adds a restrictive production Content Security Policy, denies framing and high-risk browser permissions, disables MIME sniffing, isolates opener/resources, and uses a strict referrer policy. WebSockets validate the first-party Origin. No service credentials are shipped to the client.

## Information allowlists

`publicState()` builds a new public object field by field. `publicSettings()` removes content pools and private host controls before any room snapshot leaves the object. `privateState(player)` adds only that player’s permitted secret and gives full editable settings only to the host in safe stages. The implementation does not serialize internal state and remove secrets afterward. Role-ready progress is aggregate-only so timing does not identify a Mole. Votes remain aggregate-only until the accusation is resolved.

## Data minimization

Moley stores no accounts or contact details. Operational logs contain anonymous room lifecycle dimensions, not reconnect tokens, vote contents, chat transcripts, or secret words. Room state is isolated per Durable Object. Alarms delete fully disconnected abandoned lobbies after two hours, inactive games after six hours, and completed matches after 24 hours; expired disconnected seats are removed after their reservation window.

## Pre-launch adversarial check

The automated core tests cover illegal transitions, scoring boundaries, tie cutoffs, normalized aliases, co-winners, and word uniqueness. Protocol schemas reject unknown/malformed action shapes. Before a DNS cutover, run the multi-client browser suite and load harness against the deployed preview, then repeat these manual probes in browser developer tools:

1. Edit a displayed score/role and verify the next snapshot restores it.
2. Send a host event from a non-host socket and verify rejection.
3. Replay the same event ID and verify no second mutation.
4. Submit a second vote, a self-vote, and a spectator vote.
5. Inspect innocent, Mole, and display frames for forbidden fields.
6. Join using `<script>alert(1)</script>` and confirm it renders only as text or is normalized.
7. Send a payload above 128 KiB and a malformed JSON frame.
8. Open one seat in two tabs and verify the old socket is replaced.
9. Create/join rapidly and verify friendly 429 responses.
10. Lock the room and verify new players cannot take active seats.

Record date, deployment SHA, browser versions, and outcome for the release checklist. Do not claim a production penetration test from local unit coverage.
# Replayability security regression

Moley 2.4 adds no image upload endpoint. Drawing clues are Zod-validated normalized coordinates with per-stroke and total-point caps. Notes are length-bounded and private. Crowd/custom packs have count, size, duplicate, singular/plural and blacklist controls. Reactions and predictions are bounded by role, stage and count.

Feature kill switches are enforced on the Worker, not merely hidden in the React UI. Completed history is bounded. Spectator predictions, private notes, reconnect tokens, roles and secret words are excluded from public projections until their explicitly safe reveal state (predictions reveal as totals only; notes and tokens never reveal).

The Game Health support code contains build/protocol, broad capability booleans, connection state, latency bucket data, stage and seat count. It excludes room codes, names, text content, role/word data, votes and identifiers.

The 2.5 pre-launch evidence and residual risks are recorded in `docs/security-summary.md` and `docs/final-audit-report.md`.
