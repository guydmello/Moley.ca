# Feature flags and kill switches

Moley 2.4 has one typed feature registry shared by the Worker and client. A feature is in one lifecycle state:

- `development`: checked in but unavailable to public clients
- `beta`: public, labelled as evolving, and server-authoritative
- `production`: public and supported
- `disabled`: unavailable

The Worker is authoritative. Hiding a control in the browser is never the security boundary. Chat, drawing, custom packs, spectator predictions, AI and other controlled actions are checked again in `GameRoom` before state changes.

`FEATURE_FLAGS_JSON` supplies lifecycle states. The following emergency variables take precedence when set to `true`:

```text
KILL_AI
KILL_CHAT
KILL_CUSTOM_PACKS
KILL_DRAWING
KILL_SPECTATOR_PREDICTIONS
KILL_EXTERNAL_SHARING
KILL_COSMETICS
```

Flags are refreshed when a room handles HTTP or WebSocket traffic. Invalid JSON or unknown values are ignored and checked-in defaults remain in force. `/api/config` exposes only public lifecycle state, release notes and compatibility data; it contains no account or secret configuration.

To disable a feature in production, change the corresponding Worker variable, deploy, verify `/api/config`, then attempt the disabled action with an existing room. Removing a control from the client is not a sufficient rollback test.
