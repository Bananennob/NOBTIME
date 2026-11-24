# NOBTIME community server

The chat, accounts, friends and sync run inside the same Cloudflare Worker that serves the website
(`/api/*`). Data lives in a SQLite-backed Durable Object (class `Hub`), created automatically on
deploy through `wrangler.jsonc`. No separate database or URL is needed.

Local test: see `worker.js` (`Hub` expects `ctx.storage.sql`).
