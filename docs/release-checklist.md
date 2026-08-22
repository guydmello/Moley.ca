# Release checklist

## Automated gates

- TypeScript strict mode passes in every workspace
- ESLint passes with no warnings
- Unit and integration tests pass
- Client and Worker production builds pass
- Multi-client browser journey passes on mobile and desktop projects
- 100-seat and reconnect-storm load scenarios meet the release latency/error budget
- Workers AI success, malformed, leak, timeout, and unavailable mocks all fall back safely

## Gameplay matrix

Record a pass/fail and issue link for: four humans in person; two humans plus two bots; one human plus three bots; eight remote humans; remote humans and bots; pass-the-phone; TV with phones; multiple Moles; 20-player rapid mode; host disconnect; player disconnect mid-clue; refresh during role reveal; AI unavailable; all timers disabled; rapid timers; typed clues; and spoken clues.

## Visual review

Review the landing, create/join, lobby, role, clue, discussion, vote, reveal, scoreboard, rules, pass-the-phone, and display screens at 375, 430, 768, and 1440 CSS pixels. Verify safe areas, focus visibility, contrast, 44px touch targets, long names, 100-player rosters, reduced motion, 200% text zoom, keyboard-only flow, and screen-reader labels.

## Production smoke

Verify HTTPS, apex/`www` redirect, PWA installation, QR scan, native share fallback, WebSocket reconnect across Wi-Fi/cellular, host transfer after the grace period, room locking, stale-seat removal, and no forbidden information in Mole or display frames.
