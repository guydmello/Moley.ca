# Private data inventory

Audit date: 2026-08-27
Scope: online Durable Object rooms, every WebSocket participant type, browser persistence, offline Local Play, and online/local TV displays.

Moley has no accounts, email addresses, advertising identifiers, or contact database. A display name is room-scoped. “Sensitive” below includes game secrets and capabilities even when it is not personal information.

## Online room data

| Data | Stored where | Who receives it | Reveal rule | Deletion / retention |
| --- | --- | --- | --- | --- |
| Secret word and aliases | `GameRoom` Durable Object room snapshot | Innocents receive only the display word in their private envelope; server-side bot logic receives it only for innocent bots | Public, Mole, spectator, and TV receive it only in round reveal/recap/score stages | Replaced at the next round; completed display word remains in bounded 24-round history; entire inactive room is deleted after 2h in lobby, 6h in a game, or 24h after match completion |
| Roles, Mole IDs, fellow-Mole IDs | Durable Object player records and `moleIds` | Each human receives only their own role; a Mole receives fellow IDs only when blind Moles are off; deterministic bots use only their assigned role inputs | Public result exposes Mole/caught IDs after the round | Player roles reset at the next round; room deletion deadlines above apply |
| Canonical board | Durable Object `board` | Every participant and public display receives `{id, display}` entries when Board Play is enabled | Public from role reveal onward; it is intentionally the shared candidate set and includes the secret among decoys | Replaced each round; removed with room |
| Individual votes and confidence | Per-player Durable Object fields | The voter receives their own locked vote; the authority resolves all votes | Depending on vote-reveal mode, public output is identified, incremental, or anonymous; history retains totals, not raw private votes | Reset next round; room deletion deadlines above apply |
| Mole guesses and spoken judgements | Per-player Durable Object fields during final guess | Guessing Mole; host receives only pending Mole IDs when judging spoken guesses | Correct-guess Mole IDs and scoring become public with the round result | Raw guess resets next round and is not copied into history; result summary follows room retention |
| Private notebook | Per-player Durable Object field | Only its owner | Never public | Cleared at next round; room deletion deadlines above apply |
| Private reactions | Per-player `reactionsUsed`; aggregate room counts | Sender receives their own used list; no participant receives another person’s list | Aggregate emoji counts only after round completion | Reset next round; room deletion deadlines above apply |
| Spectator prediction | Spectator player record | Only that spectator sees their selected player before reveal | Aggregate totals only after round completion | Reset next round; room deletion deadlines above apply |
| Custom words, categories, blacklist, forbidden clues | Host settings and room-only content pools in the Durable Object | Full settings only to the host in lobby/scoreboard; allowed forbidden words to an innocent during play; public settings contain empty arrays | Custom/category pools and blacklist never reveal; the chosen display word follows secret-word rules | Custom settings remain only for room lifetime; crowd words reset only with room or rematch settings changes as implemented; no permanent public word database |
| Crowd-pack submissions | Room `crowdWords`, associated with submitting player ID | Submitter sees their own words; public receives count only; host’s settings do not contain other players’ submissions | A selected word can become the round secret and follows secret-word rules | Room lifetime only; removed with room |
| Reconnect token / host capability | Durable Object player record and browser `moley:session:*` localStorage | The token is returned once to that browser and then sent only in the WebSocket subprotocol; public display receives an empty token in its minimal private envelope | Never public; never placed in the WebSocket URL | Server copy is removed with the seat/room; disconnected non-host seats are reserved 2 minutes; browser copy remains until site data is cleared but becomes unusable after server deletion |
| Bot minds, suspicion, candidate confidence, clue memory | Durable Object bot fields and room bot-memory map | Server-side deterministic bot engine only | Never serialized publicly; only resulting clue/chat/vote/guess is shown at its normal stage | Minds reset for a round; bounded clue memory survives within room; deleted with room |
| Chat and drawing clues | Durable Object bounded room/player fields | Public participants receive chat only when enabled; drawings/clues reveal in turn or recap according to mode | Chat is public to the room; anonymous clues omit author identity until recap; vector drawings are public clue content, never uploads | Chat capped at 100; drawings omitted from bounded history bodies; remaining room data follows room deletion deadlines |
| Processed event IDs, sequence counters, timers, presence | Durable Object operational state | Clients receive only public timer/presence and server sequence envelopes | No private content reveal | Event IDs bounded to 500; room deletion deadlines above apply |

## Offline Local Play data

| Data | Stored where | Who receives it | Reveal rule | Deletion / retention |
| --- | --- | --- | --- | --- |
| Complete local authority state: secret, roles, board, turn order, votes, bot minds, clue memory, guesses, scores, history | IndexedDB `moley-local/sessions/active` plus encoded `moley:local:recovery` write-ahead record | The local host device only | React screens expose private data only after a neutral handoff; role/vote/guess reveal state itself is never persisted | Retained until **Start Fresh**, site-data clearing, or browser eviction; schema migrations preserve valid games and damaged records fail closed |
| Local public-display snapshot | Allowlisted `moley:local:public-display:<sessionId>` localStorage record plus transient same-origin `BroadcastChannel` messages | Only same-origin windows attached to that session ID | Board, stage, public clues, vote count, score, and completed result only; no secret ID, Mole IDs, raw votes, bot minds, or guesses before reveal | Replaced after each transition and removed by **Start Fresh**; a stale indicator warns if the host stops publishing |
| Saved local custom pack | `moley:local:saved-pack` localStorage | Local device setup UI and local engine | Never transmitted; any selected secret follows local handoff rules | Until overwritten or site data is cleared |
| Local aggregate stats / idempotency markers | `moley:local:stats` and per-match localStorage markers | Local device only | Aggregate matches/rounds only | Until site data is cleared |
| Player names and preferences | Local storage keys for name, settings, theme, accessibility, audio, tutorial, and locale | Local browser only; the selected online name is sent when joining a room | Name is public to that room; preferences are never sent as identity data | Until overwritten or site data is cleared |

## Public-display allowlists

Online TV is an explicit `display` spectator capability. It is omitted from the visible player roster, cannot chat, react, predict, vote, submit clues, or invoke host actions, and receives an empty reconnect token in ongoing snapshots. Its own browser stores a separate display session so opening a TV tab cannot overwrite the host’s player session.

Local TV never receives `LocalGameState`. `toLocalPublicDisplay()` creates a new allowlisted object, and `validateLocalPublicDisplay()` rejects unknown or malformed keys. Unit tests recursively reject `secretWordId`, `moleIds`, `votes`, `botMinds`, `botClueMemory`, reconnect tokens, and guesses. Browser tests inspect the raw persisted public snapshot before reveal.

## Unsupported roles and results

Moderator, Double Agent, Jester, Accomplice, Decoy, side missions, tournaments, and achievement accounts are not implemented or advertised. There is therefore no stored moderator capability, side-mission result, special-role result, tournament record, or server-side achievement profile to inventory. These are `N/A`, not silently treated as ordinary players.

## Logging and caches

Operational logs contain lifecycle dimensions such as room age, seat count, stage, and fallback use. They do not intentionally log names, room codes, reconnect tokens, secret words, votes, clues, chat text, or custom pools. Runtime API requests use `no-store`; the service worker denies `/api` caching and caches only the static application shell/assets.
