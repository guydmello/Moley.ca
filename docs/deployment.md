# Cloudflare deployment and domain migration

## Deploy from GitHub

1. Create a Cloudflare account and note the account ID.
2. Create a narrowly scoped `Edit Cloudflare Workers` API token limited to the deployment account. Never commit or paste the token into project files or chat.
3. In GitHub repository settings, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as Actions secrets.
4. Run `npm run check` locally.
5. Push a branch and verify the pull-request workflow.
6. Merge to `main`. The workflow repeats verification and runs the unified deploy.
7. Confirm `/api/health`, room creation, two-player reconnect, and a bot-assisted match on the `workers.dev` preview before attaching the domain.

The `v1` migration creates the SQLite-backed `GameRoom` Durable Object class. Add future migration tags; never rename or delete the existing tag. Deploy schema changes before code that depends on them when backward compatibility requires it.

Version 2.4 keeps the existing SQLite table and normalizes stored JSON snapshots at load. Before deploy, verify `/api/config` reports app `2.4.0`, protocol `2`, and range `2..2`; then refresh an old tab and confirm it can rejoin with its saved token. Feature lifecycle changes use `FEATURE_FLAGS_JSON`; emergency kill variables are documented in `docs/feature-flags.md`.

## Move moley.ca safely from GoDaddy

GoDaddy can remain the registrar. Do not cancel or transfer the registration merely to use Cloudflare hosting.

### 1. Back up current DNS

In GoDaddy, export the zone if available and separately capture every record: type, host, value, TTL, MX priority, and any verification records. Note current apex and `www` behaviour. Lower relevant web-record TTLs to 300 seconds at least a day before cutover when possible.

### 2. Add the zone to Cloudflare

Add `moley.ca` to Cloudflare and compare the imported records line by line with the backup. Preserve mail records (MX, SPF, DKIM, DMARC), verification records, and unrelated subdomains exactly. Cloudflare will provide two authoritative nameservers.

### 3. Attach the Worker route

Add the custom domain `moley.ca` to the deployed Worker. Add `www.moley.ca` as well. The Worker implements one canonical redirect from `www` to the apex with a 301 and preserves the request path and query. Keep both hostnames on HTTPS.

### 4. Change nameservers at GoDaddy

In the domain’s GoDaddy nameserver settings, replace the current nameservers with the two Cloudflare values. This changes DNS authority, not ownership. Leave the domain registration active and locked.

### 5. TLS and verification

Use Cloudflare Full (strict) SSL. Wait for Universal SSL to become active. Verify from multiple networks:

- `https://moley.ca` serves the new landing page
- `https://www.moley.ca` redirects once to the apex
- certificate names and expiry are correct
- HTTP redirects to HTTPS
- mail and unrelated subdomains still resolve
- create/join WebSockets stay connected through Cloudflare
- PWA manifest, icons, and share card use HTTPS

Run a complete four-seat match, display mode, refresh/reconnect, and host transfer before announcing the cutover.

### 6. Rollback

If critical gameplay or DNS services fail, restore the previous nameservers at GoDaddy from the backup. Because nameserver changes are cached, recovery is not instantaneous. Keep the former hosting service and its records intact for at least 72 hours after successful cutover. Do not delete the Cloudflare zone while diagnosing; compare authoritative DNS answers first.

## Environment and cost controls

Core play uses only Workers, Durable Objects, static assets, and WebSockets. Workers AI is optional. Configure AI budgets/notifications in Cloudflare and leave the binding disabled if desired; bot play continues deterministically. Review anonymous lifecycle logs and Durable Object usage, but never add session tokens, vote bodies, or full chat history to logs.
