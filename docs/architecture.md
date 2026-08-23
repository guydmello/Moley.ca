# Architecture

## System shape

The browser is a renderer and input device. It never owns authoritative roles, words, votes, timers, scores, bot decisions, host status, or win conditions.

```text
React/PWA client
  │ HTTPS create/join + versioned WebSocket events
  ▼
Cloudflare Worker router
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

## Room identity and joining

Room codes are three words selected with rejection-sampled cryptographic randomness. Inputs are case-, space-, and hyphen-insensitive. Codes deterministically address Durable Objects; initialization checks for collisions before claiming a room.

Creating or joining returns a random private reconnect token. The browser stores that token locally under the normalized room code. The token, not the memorable room code, owns the seat and any host privilege.

## Canonical state

`GameRoom` persists a single allowlisted room snapshot in SQLite-backed Durable Object storage. Every mutation runs through the object’s serialized event loop. The state contains players, match settings, current stage, round secret, roles, clue order, votes, bot minds, scores, timers, processed message IDs, and reconnect metadata.

Public and private serialization are separate. Public state exposes only roster/presence, stage, permitted clues, aggregate readiness/vote progress, public timers, and revealed results. A private envelope adds only the receiving participant’s role, their word if innocent, known fellow Moles when enabled, their submissions, and host capability. Spectators never receive role or word data.

## State machine

Legal transitions are defined in `@moley/game-core`. Client events are validated by Zod, checked against the current stage, checked against the participant’s role/kind, and checked for host authority before mutation. Illegal transitions fail with a player-safe error and do not mutate room state.

Moley 2.4 adds optional `DEFENCE`, `REVOTE`, and `ROUND_RECAP` stages. Classic has a zero-second defence and no revote, so its path remains the original simple flow. Completed round history is bounded to 24 rounds and contains only information already safe to reveal after a round.

Persisted v1 snapshots are normalized against current defaults when a Durable Object wakes. Missing feature, drawing, reaction, history, notebook, prediction and AFK fields are added without invalidating reconnect tokens or active scores.

## Compatibility and feature operations

The browser sends `clientVersion` and `protocol` on WebSocket connection. The Worker advertises its supported protocol range from `/api/config` and rejects incompatible clients before accepting a socket. A current client presents a refresh-and-rejoin screen; the reconnect token remains device-local.

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
- 15-second client heartbeat and last-seen tracking
- exponential reconnect with jitter
- visibility and network-status recovery
- session restoration after refresh
- client event IDs with a rolling server deduplication window
- client and server sequence numbers
- two-minute disconnected-seat reservation
- ten-second host grace period, then transfer to the earliest connected human
- Durable Object alarms for timers, cleanup, and host transfer

## Capacity

There is no low product-level seat cap. Lists and turn rails are bounded/scrollable, chat history is capped, and payload history is truncated. The included load harness exercises a 100-seat room, multi-room fanout, voting bursts, chat bursts, and reconnect storms. Cloudflare account limits still apply; production capacity claims should be based on observed load results in the target account.

## Repository

```text
apps/web        React client, PWA, display and pass-the-phone modes
apps/worker     Worker router, Durable Object, AI adapter, security controls
packages/shared Versioned protocol, schemas, public/private types
packages/game-core State machine, selection, voting, scoring, bot reasoning
packages/word-packs Curated word metadata and category selection
tests           Browser, integration, and load scenarios
docs            Operations, security, rules, and design notes
```
