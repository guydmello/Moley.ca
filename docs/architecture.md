# Architecture

## System shape

Moley has two explicit authority boundaries. Online rooms remain server-authoritative: the browser is only a renderer and input device and never owns online roles, words, votes, timers, scores, bot decisions, host status, or win conditions. Local rooms are intentionally browser-authoritative and never connect to the backend.

```text
React/PWA client
  ├── LocalGame engine → IndexedDB recovery (offline, device-only)
  │   └── allowlisted public projection → BroadcastChannel/localStorage → Local TV
  │ HTTPS create/join + versioned WebSocket events
  ▼
Cloudflare Worker router
  ├── durable per-network AbuseGate
  │ room code → idFromName(normalizedCode)
  ▼
GameRoom Durable Object (one instance per room)
  ├── SQLite snapshot persistence
  ├── hibernatable WebSocket sessions
  ├── state machine and permission checks
  ├── timers, reconnects, host transfer, votes, scoring
  ├── deterministic bot engine
  └── optional Workers AI → validated result or fallback
```

The frontend is built to static assets and served by the same Worker, so production has one origin, one deployment, and no CORS or cookie dependency.

## Local authority and offline privacy

`@moley/game-core/local` owns local round setup, role assignment, randomized clue order, deterministic bot decisions, voting, scoring, and rematches. It reuses the canonical board builder, catalog filtering, Mole guess, scoring, fair turn ordering, bot discussion, normalization, vote reasoning, and word metadata used by online rooms. The Local Play React route does not initialize runtime configuration, create a WebSocket, call Workers AI, or use a room API.

Active state is stored in IndexedDB after every transition. An encoded localStorage write-ahead copy closes the small gap while an IndexedDB transaction is committing; recovery chooses the newest valid copy. Schema-1 and schema-2 saves migrate to schema 3 with explicit Clue Round and locked Final Guess state; damaged identities, unsupported versions, or structurally invalid private state fail closed. Private reveal visibility is UI-only, so reload, Back, Forward, page hiding, and orientation remounts return to a neutral handoff screen.

Local TV is not a second authority. `toLocalPublicDisplay()` creates a strict allowlisted projection, publishes it through a session-scoped BroadcastChannel and localStorage fallback, and validates it again in the display window. The display can attach, reload, detach, and reopen mid-match without receiving the local authority object.

This provides practical party-game privacy, not cryptographic isolation from the device owner. A technically sophisticated person with physical access and developer tools can inspect device storage. Local saves never leave the device unless the user exports their own custom word list.

## Room identity and joining

Room codes are four words selected with cryptographic randomness from a space exceeding one million combinations. Inputs are case-, space-, and hyphen-insensitive. Codes deterministically address Durable Objects; initialization checks for collisions before claiming a room. Public status probes return a uniform response so codes cannot be enumerated without making a throttled join attempt.

Creating or joining returns a random private reconnect token. The browser stores that token locally under the normalized room code. It is sent in the WebSocket subprotocol rather than the URL, avoiding proxy and access-log leakage. The token, not the memorable room code, owns the seat and any host privilege.

## Canonical state

`GameRoom` persists a single allowlisted room snapshot in SQLite-backed Durable Object storage. Every mutation runs through the object’s serialized event loop. The state contains players, match settings, current stage, canonical board, round secret, roles, clue order and recent first-player history, votes, bot minds/clue memory, scores, timers, processed message IDs, and reconnect metadata.

Public and private serialization are separate. Public state exposes only roster/presence, stage, the canonical public candidate board, permitted clues, aggregate readiness/vote progress, public timers, and revealed results. A private envelope adds only the receiving participant’s role, their word if innocent, known fellow Moles when enabled, their submissions, and host capability. Spectators never receive role or word data. Online TV uses an explicit read-only display capability, is omitted from the roster, receives a minimal empty-token private envelope, and stores its reconnect session separately from a player tab.

## State machine

Legal transitions are defined in `@moley/game-core`. Client events are validated by Zod, checked against the current stage, checked against the participant’s role/kind, and checked for host authority before mutation. Illegal transitions fail with a player-safe error and do not mutate room state.

Moley 2.4 added optional `DEFENCE`, `REVOTE`, and `ROUND_RECAP` stages. Classic has a zero-second defence and no revote, so its path remains the original simple flow. Completed round history is bounded to 24 rounds, omits vector drawing bodies, and contains only information already safe to reveal after a round.

Persisted room snapshots are normalized against current defaults when a Durable Object wakes. Missing feature, board, turn-history, display-capability, drawing, reaction, history, notebook, prediction and AFK fields are added without invalidating reconnect tokens or active scores.

## Compatibility and feature operations

The browser sends `clientVersion` and protocol 4 on WebSocket connection. The Worker advertises its supported protocol range from `/api/config` and rejects incompatible clients before accepting a socket. The Worker also validates Origin and the negotiated `moley.v4` subprotocol. A current client presents a refresh-and-rejoin screen; the reconnect token remains device-local.

Feature lifecycle state is centrally typed and re-evaluated on room traffic. Security-sensitive controls are enforced in `GameRoom`, so a stale or modified client cannot use a killed feature. See `docs/feature-flags.md`.

## Replayability projections

- drawings are normalized vector strokes, never uploaded images
- notebooks are returned only to their owner
- spectator predictions remain private until the round is complete, when only totals are public
- anonymous clue projections omit player identifiers
- secret reactions reveal only as aggregate counts
- device career totals never leave local storage
- support codes exclude names, room code, role, word, vote, clue and chat data

## Realtime reliability

- hibernatable WebSockets keep sleeping rooms inexpensive
- 15-second client heartbeat with direct `pong` replies that do not persist or fan out room snapshots
- exponential reconnect with jitter
- visibility and network-status recovery
- session restoration after refresh
- client event IDs with a rolling server deduplication window
- client and server sequence numbers
- one active socket per seat; opening another tab replaces the old socket
- two-minute disconnected-seat reservation
- ten-second host grace period, then transfer to the earliest connected human
- Durable Object alarms for timers, cleanup, and host transfer

## Capacity

Rooms accept at most 100 active players and 200 spectators. Lists and turn rails are bounded/scrollable, chat history is capped, and payload history is truncated. The included load harness exercises a 100-seat room, multi-room fanout, voting bursts, chat bursts, and reconnect storms. Cloudflare account limits still apply; production capacity claims must be based on observed target-account results rather than local tests alone.

## Repository

```text
apps/web        React client, PWA, online display and offline-first Local Play
apps/worker     Worker router, Durable Object, AI adapter, security controls
packages/shared Versioned protocol, schemas, public/private types
packages/game-core State machine, selection, voting, scoring, bot reasoning
packages/word-packs Curated word metadata and category selection
tests           Browser, integration, and load scenarios
docs            Operations, security, rules, and design notes
```
