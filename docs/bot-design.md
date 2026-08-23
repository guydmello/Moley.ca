# Bot design

Bots are participants controlled by the room server. They can be innocent or Mole, but never host. A bot icon always distinguishes them from humans.

## Information boundaries

An innocent bot may use the word, category, public clues, player names, and public discussion. A Mole bot is given the permitted category, observed clues/discussion, and known fellow Moles only. It is never handed the secret or aliases. Its hidden candidate list is built from the category pool and updated from observed semantic tags.

## Deterministic engine

The always-available engine uses curated word tags and safe clue metadata. Innocents choose non-repeating validated clues. Moles maintain candidate/confidence pairs, mimic the abstraction level of observed clues, and choose deliberately broad bluffs when uncertain. Voting scores clue absence, semantic distance, and weak evidence with difficulty-dependent noise. Personalities adjust how frequently a bot comments and how confidently it acts.

Difficulty is probabilistic:

- Easy: more obvious clues, noisy votes, broad Mole bluffs
- Normal: sensible but fallible deduction
- Sneaky: stronger semantic weighting and subtler clues, never perfect

## Workers AI enhancement

Workers AI is optional and server-side. It is used only where language quality helps, currently clue refinement. A request has a short timeout, bounded output, strict JSON extraction, word/alias leak rejection, max-length validation, and a circuit breaker after repeated failures. Any timeout, quota failure, malformed response, or unsafe clue silently uses the deterministic result.

Future AI tasks should keep the same boundary: build a role-specific prompt from only information that role is entitled to see, request one compact batch result, validate it, and never block stage progress on inference.

## Replayability controls

Hosts can quick-fill a room, rename bots and assign one of eight visible personality labels. Personalities adjust presentation and heuristic behaviour; they do not grant privileged information. AI has an independent server kill switch and deterministic behavior remains the fallback.

When AFK autopilot is enabled, a disconnected human seat can temporarily use the same bounded bot clue/vote path. The seat remains owned by its private reconnect token and is reclaimed immediately when its human reconnects. Autopilot state is public so it cannot impersonate a present human.
