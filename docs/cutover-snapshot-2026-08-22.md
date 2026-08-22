# Pre-cutover snapshot — 2026-08-22

This file records the externally visible Moley.ca state before the Cloudflare
Workers migration. Keep the former Render deployment active for at least 72
hours after cutover.

## Source control

- Repository: `https://github.com/guydmello/Moley.ca`
- Visibility: public
- State at audit: empty repository; no default branch or remote commits
- Local target branch: `main`
- Local secret scan: no Cloudflare token, private key, GitHub token, or OpenAI-style
  secret patterns found outside ignored dependency/build directories

There is no remote source history to overwrite. The first push will establish
the repository's initial `main` branch.

## Public DNS observed before migration

Observed from public authoritative DNS on 2026-08-22 in Toronto:

| Type | Name | Value | TTL |
| --- | --- | --- | ---: |
| NS | `moley.ca` | `ns73.domaincontrol.com` | 3600 |
| NS | `moley.ca` | `ns74.domaincontrol.com` | 3600 |
| SOA | `moley.ca` | `ns73.domaincontrol.com dns.jomax.net 2024070203 28800 7200 604800 600` | 3600 |
| A | `moley.ca` | `216.24.57.1` | 600 |
| CNAME | `www.moley.ca` | `realtime-chat-frontend-3fow.onrender.com` | 1800 |

No public apex `AAAA`, `MX`, `TXT`, or `CAA` answers were returned by the
queries used for this snapshot. No `_dmarc.moley.ca` TXT answer was returned.
This is not an exhaustive DNS-zone export: GoDaddy's zone export remains the
authoritative backup for uncommon subdomains and verification records.

## Live web behaviour observed before migration

- `https://moley.ca` returned `200 OK` from Render through Cloudflare's edge.
- `https://www.moley.ca` returned `301` to `https://moley.ca/`.
- The apex response identified the old Render deployment with an `rndr-id`
  header and reported a last-modified date of 2024-08-22.

## Rollback target

If the Cloudflare Worker or migrated DNS fails critically:

1. Restore GoDaddy nameservers to `ns73.domaincontrol.com` and
   `ns74.domaincontrol.com`.
2. Confirm the apex resolves to `216.24.57.1` and `www` resolves to
   `realtime-chat-frontend-3fow.onrender.com`.
3. Verify `https://moley.ca` returns the former Render application and `www`
   redirects once to the apex.
4. Keep the Cloudflare zone in place while diagnosing; do not delete either
   hosting configuration during the rollback window.

Nameserver changes are cached and rollback is not instantaneous. The complete
GoDaddy DNS export must be compared with Cloudflare's imported records before
the authoritative nameserver change.
