# NOBTIME Community Server (Cloudflare Worker + D1)

1. Cloudflare Dashboard > Storage & Databases > D1 > Create database `nobtime`.
2. Workers & Pages > Create > Worker `nobtime-api` > Deploy, then Edit code: paste `worker.js`, Deploy.
3. Worker > Settings > Bindings > Add > D1 database: variable name `DB`, database `nobtime`. Deploy.
4. Open `https://nobtime-api.<account>.workers.dev/api/ping` (should show ok), then paste that URL in the app under Community > Chat > Server.

Tables are created automatically on first request.
