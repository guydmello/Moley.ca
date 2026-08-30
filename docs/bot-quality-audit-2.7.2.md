# Moley 2.7.2 Bot Quality Audit

Date: 2026-08-30

## Quantitative result

A seeded property audit generated three Normal-mode clues in each of 25 runs for every one of the 19 bot-supported catalog entries: 1,425 selections total.

- Medium/directness-3: 751 (52.7%)
- Subtle/directness-2: 674 (47.3%)
- Direct or giveaway pool: 0
- Fallback clues: 0
- Normalized duplicate clues within a three-round sequence: 0
- Clue-pool exhaustion within a three-round sequence: 0
- Sequences staying in only one medium/subtle bucket: 50 of 475 (10.5%); the other 89.5% varied directness bucket

The property check is permanent in `packages/game-core/src/local.test.ts`. It verifies curated medium/subtle membership and normalized uniqueness rather than requiring one particular random clue.

## Representative catalog sample

The complete bot-supported catalog was sampled once with a deterministic seed. Directness uses 2 for subtle and 3 for medium. No row used a fallback.

| Secret | Category | Normal clue | Directness | Fallback |
| --- | --- | --- | ---: | --- |
| Apple | Fruits | Newton | 2 | No |
| Pizza | Food | triangle | 2 | No |
| Coffee | Beverages | aroma | 2 | No |
| Dog | Pets | kennel | 3 | No |
| Penguin | Birds | black-and-white | 2 | No |
| Canada | Countries | mosaic | 2 | No |
| Paris | Cities | Seine | 3 | No |
| Beach | Geography | boardwalk | 2 | No |
| Eiffel Tower | Landmarks | exposition | 2 | No |
| Hockey | Canada | ice | 3 | No |
| Car | Modes of Transport | commute | 2 | No |
| Beach | Vacation | tide | 2 | No |
| Hockey | Sports | Canada | 2 | No |
| Guitar | Instruments | pick | 2 | No |
| Moon | Space | waxing | 2 | No |
| Moon | Space Objects | waxing | 2 | No |
| Rainbow | Weather | prism | 3 | No |
| Beach | Places | tide | 2 | No |
| Hammer | Tools | gavel | 2 | No |

No sample was judged giveaway-level. Automated metadata and this engineering review do not replace a human party playtest, which remains a manual follow-up.
