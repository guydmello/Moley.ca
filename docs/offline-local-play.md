# Offline Local Play

## Product boundary

Local Play is a first-class, device-only mode. After one successful production load, the service worker precaches the app shell, CSS, JavaScript, icons, mascot, word library, local engine, and deterministic bot data. Ordinary local play needs no room API, WebSocket, Cloudflare Worker execution, Workers AI, cellular service, or Wi-Fi.

Works offline:

- Pass the Phone, Shared Screen, and Local Party Board
- humans plus deterministic bots
- 5×5 through 10×10 boards
- built-in and device-only custom packs
- private role handoffs, clue order, voting, scoring, match completion, and rematches
- pause, restart round, end match, sound preferences, and saved recovery

Requires online:

- remote multiplayer rooms and spectators
- remote chat and the online TV display URL
- optional Workers AI enhancement

## Persistence and recovery

The active local session is persisted after every game transition. IndexedDB is primary; an encoded localStorage write-ahead record protects refreshes that occur before an asynchronous IndexedDB commit finishes. The newest valid record wins during recovery.

The home and Local Play routes offer `Resume Local Game` or `Start New Game`. Invalid records produce `Recover What We Can` and `Start Fresh`; the recovery path retains recognizable player names but discards roles, words, votes, and scores rather than guessing at damaged private state.

Role reveal and vote-ready visibility are deliberately not stored. Navigation and reload return to neutral handoff screens.

## Deterministic bots

Bot-enabled secrets are restricted to audited entries with structured direct, medium, and subtle clue pools. Every enabled entry currently has 10 curated clue candidates plus related concepts. Clue selection filters the secret and aliases, normalizes case and simple plurals, coordinates against earlier human/bot clues, remembers recent clues for repeated concepts, and falls through related concepts, tags, then a category-related phrase without freezing.

Mole bots receive the public board, category-compatible candidates, and revealed clues—not the secret ID or innocent role state. Their candidate confidence is updated from public clue relationships. Their clue broadens when confidence is low and uses the leading candidate only as confidence rises. Final-guess accuracy is difficulty-weighted and deliberately imperfect.

## Privacy statement

Local handoff screens prevent casual shoulder-surfing and browser-history disclosure. Local browser storage cannot protect against the device owner opening developer tools or copying the browser profile. No local save is uploaded by Moley.

## Acceptance evidence

- `packages/game-core/src/local.test.ts`: order membership/fairness/restoration, semantic and unique bot clues, every board size, and 50 consecutive 10×10 rounds with 10 bots.
- `packages/word-packs/src/index.test.ts`: bot-enabled metadata minimum and normalized clue uniqueness.
- `tests/e2e/offline.spec.ts`: production service-worker precache, network disabled, complete multi-round match, two refresh/resume points, order restoration, rematch, no API resources, and Back/Forward privacy.

The browser test uses Chromium's real offline context rather than mocking an API error.
