# NOBTIME community server

The chat, accounts, friends and sync run inside the same Cloudflare Worker that serves the website
(`/api/*`). Data lives in a SQLite-backed Durable Object (class `Hub`), created automatically on
deploy through `wrangler.jsonc`. No separate database or URL is needed.

Local test: see `worker.js` (`Hub` expects `ctx.storage.sql`).

## Admin
Admin usernames are listed in `wrangler.jsonc` (`ADMINS`). Those names are reserved: registering one requires the
secret `ADMIN_KEY` (Cloudflare dashboard > Workers > nobtime > Settings > Variables and Secrets > add secret).
