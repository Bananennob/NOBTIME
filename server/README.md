# NOBTIME community server

The chat, accounts, friends and sync run inside the same Cloudflare Worker that serves the website
(`/api/*`). Data lives in a SQLite-backed Durable Object (class `Hub`), created automatically on
deploy through `wrangler.jsonc`. No separate database or URL is needed.

Local test: see `worker.js` (`Hub` expects `ctx.storage.sql`).

## Admin
The first account that uses the secret admin door in the app (tap NOBTIME 10 times, or type `nobadmin` on PC) sets the admin password; everyone else needs that password. Optional: set a Cloudflare secret `ADMIN_KEY` to override it.
