# Moley.ca

Moley is a free, no-account social deduction party game. Most players receive a secret word; one or more Moles must bluff, survive the vote, and work out what everyone else knows.

This repository is a ground-up TypeScript rebuild designed for Cloudflare's free-first stack:

- React, Vite, Tailwind CSS, Motion, Zustand, Zod, and PWA support
- Cloudflare Worker with one SQLite-backed Durable Object per room
- Hibernatable WebSockets with reconnect tokens, event IDs, and sequence numbers
- Deterministic smart bots plus optional Workers AI enhancement
- Spoken and typed clues, multiple Moles, TV display, and pass-the-phone play
- More than 800 built-in words across more than 60 categories

## Local development

Requirements: Node.js 20 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5190`. The Worker runs on port 8787 and Vite proxies `/api` and WebSockets to it. Core play needs no API key or paid service. Workers AI is optional and falls back silently to the deterministic bot engine.

Useful commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:load
```

## Production

`npm run deploy` builds the client and deploys the Worker, static assets, SQLite Durable Object migration, and Workers AI binding together. GitHub Actions verifies type safety, lint, unit tests, and production builds before deploying `main`.

See [deployment](docs/deployment.md), [architecture](docs/architecture.md), [security](docs/security.md), [bots](docs/bot-design.md), and [game rules](docs/game-rules.md).

## Privacy

Rooms are private and unlisted. Moley requires no email, phone number, birthday, or account. Active room data is scoped to one Durable Object, private tokens are never logged, and room/chat retention is intentionally short.
