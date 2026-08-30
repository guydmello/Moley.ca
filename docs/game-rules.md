# Game rules

## Aim

Find the Mole without revealing the secret word they are trying to infer.

Most players see the same word. One or more Moles see only their role and, when enabled, the category and fellow Moles. A Game Round contains one to five Clue Rounds; Classic defaults to two. Every eligible player and bot gives one clue in each Clue Round. The randomized order stays fixed through those Clue Rounds and is randomized again for the next Game Round. Only after the configured count is complete does the group discuss and secretly vote.

When Board Play is enabled, every player, spectator, reconnect, and TV display sees one authoritative 5×5 through 10×10 candidate board. It contains the secret word and normalized-unique decoys. The board is public; the innocent’s private reveal identifies which board word is secret.

With multiple Moles, the top N vote-getters are accused, where N is the number of Moles. A tie at the cutoff is resolved by server-secure randomness; the coin/wheel animation only presents the already-decided result.

## Scoring

- An unaccused Mole earns 2 points.
- A caught Mole who correctly guesses the word earns 1 point.
- A caught Mole who misses earns 0.
- A caught Mole who gives no answer before the timer expires is treated as a miss.
- Innocents each earn 2 only when every Mole is caught and no caught Mole guesses the word.

The default target is 5. The current round always finishes. Everyone at or above the target is considered; the highest score wins and equal high scores are co-winners. Endless mode has no automatic match end.

## Clues

Spoken mode is ideal in person or beside a voice call. Typed mode collects clues privately and reveals them only when that player’s turn arrives. The host may configure one to five Clue Rounds before voting, require one word, set a length, or use a rapid timer. Quick defaults to one Clue Round, Classic to two, and the more investigative presets to three through five.

Do not say the word, spell it, use an obvious variation, or show another person your private role. You cannot vote for yourself, and the game engine rejects votes before all required Clue Rounds finish.

## Alternate play

Local / Offline Game has two presentations. One Device keeps every role, vote, and caught-Mole Final Guess behind a neutral handoff screen. TV / Second Screen keeps those private actions on the host device while the display shows only the public board, Game/Clue Round progress, clues, vote progress, results, and scores. It never receives roles, the unrevealed word, individual votes, bot reasoning, or the local save. Online TV is likewise a dedicated read-only participant, not an ordinary spectator with controls.

The clue order is newly randomized each Game Round. The fairness rule softly avoids repeatedly choosing the same first player and prevents an identical whole-roster order, but it is not a predictable rotation.

# Optional advanced rules

Classic still uses spoken clues, immediate accusation, no defence/revote, all-at-once vote reveal and the original scoring below. Hosts can deliberately choose other presets or advanced rules:

- Emoji clues accept emoji only. Drawing clues use a bounded in-app canvas with no image uploads.
- Anonymous clues hide the author until the completed-round recap.
- A defence phase lets accused players speak before one optional revote.
- Confidence is expressive only; it does not change score or vote weight.
- Vote reveal can be all at once, incremental, or anonymous.
- Chaos announces one modifier for that round; it never changes private information boundaries.
- Spectator predictions close with voting and reveal as aggregate totals only.
- Rematches can preserve scores, reset scores, or return to setup.
