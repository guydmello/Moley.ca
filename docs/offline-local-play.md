# Offline Local Play

## Product boundary

Local Play is a first-class, device-only mode. After one successful production load, the service worker precaches the app shell, CSS, JavaScript, icons, mascot, word library, local engine, and deterministic bot data. Ordinary local play needs no room API, WebSocket, Cloudflare Worker execution, Workers AI, cellular service, or Wi-Fi.

Works offline:

- one Local / Offline Game with One Device or TV / Second Screen presentation
- Local TV Display through a same-origin window, including attach/reload/detach/reopen while offline
- humans plus deterministic bots
- 5×5 through 10×10 boards
- built-in and device-only custom packs
- private role handoffs, one to five Clue Rounds, voting, mandatory caught-Mole Final Guess, scoring, match completion, and rematches
- pause, restart round, end match, sound preferences, and saved recovery

Requires online:

- remote multiplayer rooms and spectators
- remote chat and the online TV display URL
- optional Workers AI enhancement

## Persistence and recovery

The active local session is persisted after every game transition. IndexedDB is primary; an encoded localStorage write-ahead record protects refreshes that occur before an asynchronous IndexedDB commit finishes. The newest valid record wins during recovery. Schema-1 and schema-2 sessions migrate to schema 3 while preserving the private word, roles, board, stable order, and safe round position; unsupported or structurally damaged saves fail closed.

The home and Local Play routes offer `Resume Local Game` or `Start New Game`. Invalid records produce `Recover What We Can` and `Start Fresh`; the recovery path retains recognizable player names but discards roles, words, votes, and scores rather than guessing at damaged private state.

Role, vote, and Final Guess reveal visibility are deliberately not stored. Navigation, page hiding, and reload return to neutral handoff screens. A locked Final Guess is recoverable until public reveal, then the private field, votes, and bot reasoning are cleared.

The Local TV window receives an allowlisted `LocalPublicDisplayState`, never the authority save. BroadcastChannel provides live same-origin updates and a session-scoped public localStorage snapshot supports reload/storage-event recovery. Starting fresh removes that public snapshot.

## Deterministic bots

Bot-enabled secrets are restricted to audited entries with structured direct, medium, and subtle clue pools. Every enabled entry has at least 10 curated candidates plus related concepts. Normal interleaves medium and subtle candidates before considering direct clues; composite indirect fallbacks prevent duplicates in multi-bot/multi-round games. Selection filters the secret and aliases, normalizes case and simple plurals, coordinates against earlier human/bot clues across the whole Game Round, and remembers recent clues for repeated concepts.

Mole bots receive the public board, category-compatible candidates, and revealed clues—not the secret ID or innocent role state. Their candidate confidence is updated from public clue relationships. Their clue broadens when confidence is low and uses the leading candidate only as confidence rises. Final-guess accuracy is difficulty-weighted and deliberately imperfect.

## Privacy statement

Local handoff screens prevent casual shoulder-surfing and browser-history disclosure. Local browser storage cannot protect against the device owner opening developer tools or copying the browser profile. No local save is uploaded by Moley.

## Acceptance evidence

- `packages/game-core/src/local.test.ts`: order membership/fairness/restoration, semantic and unique bot clues, every board size, and 50 consecutive 10×10 rounds with 10 bots.
- `packages/word-packs/src/index.test.ts`: bot-enabled metadata minimum and normalized clue uniqueness.
- `tests/e2e/offline.spec.ts`: production service-worker precache, network disabled, complete multi-round match, two refresh/resume points, order restoration, rematch, no API resources, and Back/Forward privacy.
- `tests/e2e/local-tv.spec.ts`: public-only raw snapshot plus attach, reload, detach, and reopen behaviour.
- `tests/e2e/local-devices.spec.ts`: every 5×5–10×10 board on phone/laptop/TV and the complete required 14-viewport matrix.

The browser test uses Chromium's real offline context rather than mocking an API error.
