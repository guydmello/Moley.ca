# Load testing

The load harness is intentionally external to the game engine. It creates real rooms through HTTP, joins real seats, opens real WebSockets, and can exercise fanout, chat bursts, reconnect storms, and simultaneous voting.

```bash
# 100 players in one room
npm run test:load

# 100 rooms with 10 players each
MOLEY_LOAD_ROOMS=100 MOLEY_LOAD_SEATS=10 npm run test:load

# Reconnect or chat storms
MOLEY_LOAD_SCENARIO=reconnect-storm npm run test:load
MOLEY_LOAD_SCENARIO=chat-burst npm run test:load

# Advance a room to voting and submit together
MOLEY_LOAD_SCENARIO=simultaneous-vote npm run test:load
```

Set `MOLEY_LOAD_URL` to a preview Worker URL for production-like measurements. Do not run high-volume scenarios against public production rooms without an approved test window.

## Observed local result

On 2026-08-22, the default one-room scenario joined and connected 100 seats in 4,188 ms on the local Wrangler runtime, then completed a 100-socket heartbeat fanout with zero harness failures. This verifies the product does not impose a low seat cap; it is not a claim of unlimited or globally representative Cloudflare capacity. Run all scenarios against the target account and record p50/p95 message latency, Worker CPU, Durable Object memory, fanout time, and failure rate before setting a public capacity promise.
