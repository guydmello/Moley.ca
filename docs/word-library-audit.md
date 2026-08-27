# Word Library Audit

Audit date: 2026-08-27

## Summary

| Metric | Result |
| --- | ---: |
| Total word entries | 1,167 |
| Categories | 80 |
| Bot-enabled entries | 19 |
| Unique bot-enabled concepts | 16 |
| Curated clues per bot-enabled entry | 10 |
| Average curated clue count | 10.0 |
| Minimum curated clue count | 10 |
| Bot-enabled entries below minimum | 0 |
| Entries disabled as bot secrets | 1,148 |

Duplicate displays across categories retain separate IDs. `Beach`, `Hockey`, and `Moon` are intentionally bot-enabled in multiple relevant categories with the same concept metadata. The `Apple` technology brand entry is intentionally excluded because the curated Apple clues describe the fruit.

## Bot-enabled coverage

| Category | Supported concepts | Entries | Average | Minimum |
| --- | --- | ---: | ---: | ---: |
| Beverages | Coffee | 1 | 10 | 10 |
| Birds | Penguin | 1 | 10 | 10 |
| Canada | Hockey | 1 | 10 | 10 |
| Cities | Paris | 1 | 10 | 10 |
| Countries | Canada | 1 | 10 | 10 |
| Food | Pizza | 1 | 10 | 10 |
| Fruits | Apple | 1 | 10 | 10 |
| Geography | Beach | 1 | 10 | 10 |
| Instruments | Guitar | 1 | 10 | 10 |
| Landmarks | Eiffel Tower | 1 | 10 | 10 |
| Modes of Transport | Car | 1 | 10 | 10 |
| Pets | Dog | 1 | 10 | 10 |
| Places | Beach | 1 | 10 | 10 |
| Space | Moon | 1 | 10 | 10 |
| Space Objects | Moon | 1 | 10 | 10 |
| Sports | Hockey | 1 | 10 | 10 |
| Tools | Hammer | 1 | 10 | 10 |
| Vacation | Beach | 1 | 10 | 10 |
| Weather | Rainbow | 1 | 10 | 10 |

## Enforcement

`packages/word-packs/src/index.test.ts` fails when a bot-enabled entry lacks structured clue groups, has fewer than nine normalized unique curated clues, contains an empty clue, or includes the secret itself. Local boards may contain any eligible built-in or custom word, but a game containing bots chooses its secret only from this supported subset. Human-only games may use the full library.

This policy prefers a smaller trustworthy deterministic-bot pool over meaningless generic clues. Expanding bot coverage requires adding reviewed metadata and passing the gate.
