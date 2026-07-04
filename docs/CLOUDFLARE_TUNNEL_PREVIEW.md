# Cloudflare Tunnel Preview

This runbook is for temporary preview/demo access from a local or dev machine. It is not a production deployment path.

Use Cloudflare Tunnel only for the web entrypoint that users need to open in a browser. Do not expose MongoDB, database ports, admin-only internal ports, or the backend port directly unless you intentionally run a split-origin preview and configure CORS to the exact frontend origin.

Official references:

- Cloudflare Quick Tunnels: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- Cloudflare Tunnel downloads: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
- Remotely-managed tunnels: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/

## Current App Shape

- Backend: Node/Express, default `PORT=5000`, API under `/api`.
- Frontend dev server: Vite on `3000`, proxies `/api` to `http://localhost:5000`.
- Docker preview: Caddy listens on `HTTP_PORT` default `8080` and proxies `/api/*` to the backend container.
- Frontend API client: `VITE_API_URL` defaults to empty, so browser requests use same-origin `/api`.
- Auth: httpOnly auth cookie plus CSRF cookie/header. Keep same-origin preview whenever possible so cookie and CSRF behavior matches production.

## Environment Mapping

This repo does not currently use generic `PUBLIC_APP_URL`, `API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, or `CSRF_ALLOWED_ORIGINS` variables.

Use these supported variables instead:

- `PUBLIC_ORIGIN`: Docker Compose public browser origin; passed to backend as `FRONTEND_URL`.
- `FRONTEND_URL`: backend CORS origin. Set to the exact public HTTPS frontend URL when the browser calls the backend across origins.
- `VITE_API_URL`: frontend API origin without `/api`. Keep empty for same-origin `/api` through Vite or Caddy.
- `TRUST_PROXY=true`: required when running production-like preview behind Cloudflare.
- `NODE_ENV=production`: recommended for public preview so auth cookies are marked `Secure`.

Cookie flags are code-defined: `Secure` follows `NODE_ENV=production`, and `SameSite` is `lax`. Do not change these for a tunnel demo.

## Prerequisites

- Node.js and npm for local dev, or Docker Desktop for the Docker/Caddy path.
- A working MongoDB connection string. Use Atlas or local MongoDB bound only to localhost. Do not expose MongoDB through Cloudflare Tunnel.
- Real local-only secrets in `.env` or `.env.docker`; never commit them.
- `cloudflared` installed and available on `PATH`.

Install `cloudflared`:

- Windows: download the latest MSI or executable from the Cloudflare Tunnel downloads page, then run `cloudflared --version`.
- macOS: `brew install cloudflared`.
- Linux: use the Cloudflare package repository or download the release package from the downloads page.

## Preferred Preview: Same-Origin Docker/Caddy

This is closest to production and exposes only one local web entrypoint.

1. Create local Docker env from the example:

```powershell
Copy-Item .env.docker.example .env.docker
```

2. Edit `.env.docker` locally only:

```env
APP_SITE_ADDRESS=:80
PUBLIC_ORIGIN=http://localhost:8080
HTTP_PORT=8080
HTTPS_PORT=8443
VITE_API_URL=
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/agent-lottery
JWT_SECRET=replace-with-a-long-random-local-preview-secret
CRON_SYNC_TOKEN=replace-with-a-long-random-local-preview-secret
TRUST_PROXY=true
AUTO_SEED_ADMIN=false
AUTO_SEED_CATALOG=false
```

For local MongoDB from Docker, use a host-only URI such as `mongodb://host.docker.internal:27017/agent-lottery`. Do not publish the MongoDB port publicly.

3. Start the app:

```powershell
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

4. Open the local app first:

```text
http://localhost:8080
```

5. Start a Quick Tunnel to the web entrypoint:

```powershell
cloudflared tunnel --url http://localhost:8080
```

6. Copy the printed `https://...trycloudflare.com` URL. If you see CORS or cookie issues, update `.env.docker` so `PUBLIC_ORIGIN` is that exact HTTPS URL, then recreate the backend:

```powershell
docker compose --env-file .env.docker up -d --no-deps --force-recreate backend
```

Quick Tunnel URLs change every time the tunnel restarts. Repeat this update after each new URL if the backend needs exact-origin alignment.

## Dev Server Preview: Vite Proxy

Use this when you do not want Docker. It still exposes only the frontend dev server; Vite proxies `/api` to backend locally.

1. Start backend on `5000` with production-like cookie settings:

```powershell
cd backend
$env:NODE_ENV='production'
$env:PORT='5000'
$env:FRONTEND_URL='http://localhost:3000'
$env:TRUST_PROXY='true'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/agent-lottery'
$env:JWT_SECRET='replace-with-a-long-random-local-preview-secret'
$env:CRON_SYNC_TOKEN='replace-with-a-long-random-local-preview-secret'
$env:AUTO_SEED_ADMIN='false'
$env:AUTO_SEED_CATALOG='false'
npm run dev
```

2. Start frontend on `3000` with same-origin API calls:

```powershell
cd frontend
$env:VITE_API_URL=''
npm run dev -- --host 127.0.0.1 --port 3000
```

3. Start a Quick Tunnel to Vite:

```powershell
cloudflared tunnel --url http://localhost:3000
```

4. If cross-origin requests are introduced or the backend starts returning CORS errors, restart backend with `FRONTEND_URL` set to the exact printed HTTPS tunnel URL.

## Named Tunnel Preview

Use this when a stable preview hostname is required, for example `preview.example.com`. This requires a Cloudflare account and a domain in Cloudflare.

Recommended mapping is still one hostname to the web entrypoint:

```text
preview.example.com -> http://localhost:8080
```

Dashboard-managed flow:

1. In Cloudflare Zero Trust, create a Cloudflare Tunnel.
2. Install/run the connector command shown by the dashboard on the local/dev machine.
3. Add a Public Hostname:
   - Hostname: `preview.example.com`
   - Service: `http://localhost:8080` for Docker/Caddy, or `http://localhost:3000` for Vite dev.
4. Set local env before starting the app:

```env
PUBLIC_ORIGIN=https://preview.example.com
VITE_API_URL=
TRUST_PROXY=true
```

CLI locally-managed flow:

```powershell
cloudflared tunnel login
cloudflared tunnel create agentlottery-preview
cloudflared tunnel route dns agentlottery-preview preview.example.com
```

Keep the generated credentials under the user profile cloudflared directory, not in this repo. Example config path outside the repo:

```yaml
# C:\Users\<you>\.cloudflared\agentlottery-preview.yml
tunnel: <tunnel-uuid>
credentials-file: C:\Users\<you>\.cloudflared\<tunnel-uuid>.json
ingress:
  - hostname: preview.example.com
    service: http://localhost:8080
  - service: http_status:404
```

Run it:

```powershell
cloudflared tunnel --config "$env:USERPROFILE\.cloudflared\agentlottery-preview.yml" run agentlottery-preview
```

## Split-Origin Fallback

Prefer same-origin. Use split-origin only if a separate public backend URL is unavoidable.

Example:

```text
https://preview.example.com     -> frontend http://localhost:3000
https://api-preview.example.com -> backend  http://localhost:5000
```

Required env:

```env
# backend
FRONTEND_URL=https://preview.example.com
TRUST_PROXY=true
NODE_ENV=production

# frontend build/dev env
VITE_API_URL=https://api-preview.example.com
```

Rules:

- Do not use wildcard CORS.
- Do not expose MongoDB.
- Do not disable CSRF.
- Do not set `VITE_API_URL` with `/api`; the frontend appends `/api` itself.

## Smoke Test Checklist

Use the public HTTPS URL from another browser or network.

1. Open `/api/health` and `/api/ready` through the same public origin if using Caddy/Vite proxy.
2. Open the app URL and log in with a preview account.
3. Confirm protected pages load after refresh.
4. Create or update a harmless test record to verify CSRF-bearing writes.
5. Log out and confirm protected pages redirect to login.
6. In browser devtools, confirm:
   - `agentlottery_auth` is `HttpOnly` and `Secure` for public HTTPS preview.
   - `agentlottery_csrf` exists and unsafe requests include `X-CSRF-Token`.

## Share the Preview

Send only the frontend URL, for example:

```text
https://<random>.trycloudflare.com
https://preview.example.com
```

Do not share local ports, MongoDB URIs, tunnel tokens, connector install tokens, or `.env` contents.

## Stop and Cleanup

Quick Tunnel:

```powershell
# Stop cloudflared
Ctrl+C

# Docker path
docker compose --env-file .env.docker down

# Dev path: stop backend/frontend terminals
Ctrl+C
```

Named Tunnel:

```powershell
# Stop the running connector
Ctrl+C

# If the tunnel was temporary and no longer needed
cloudflared tunnel delete agentlottery-preview
```

Also remove the public hostname/DNS record from the Cloudflare dashboard if it was only for this demo. Keep credential files outside the repo and delete them manually if the tunnel is retired.

## Security Checklist

- Tunnel only `http://localhost:8080` or `http://localhost:3000` unless split-origin is explicitly required.
- Never tunnel MongoDB or any database/admin port.
- Keep `VITE_API_URL=` for same-origin preview.
- Use exact `FRONTEND_URL`/`PUBLIC_ORIGIN`; never use wildcard CORS.
- Keep `TRUST_PROXY=true` behind Cloudflare.
- Keep `NODE_ENV=production` for public preview when validating Secure cookies.
- Keep CSRF middleware enabled.
- Use preview-only accounts and data.
- Stop the tunnel immediately after the demo.

## Troubleshooting

- Cookie does not stick: confirm the URL is HTTPS, backend is running with `NODE_ENV=production`, and the browser is not blocking third-party cookies. Prefer same-origin `/api` instead of split-origin.
- CORS failure: set `FRONTEND_URL` or `PUBLIC_ORIGIN` to the exact public HTTPS frontend origin and restart backend.
- CSRF failure: make sure the app is using the frontend API client, the `agentlottery_csrf` cookie exists, and unsafe requests include `X-CSRF-Token`.
- Quick Tunnel URL changed: update `PUBLIC_ORIGIN`/`FRONTEND_URL` and restart the backend if exact origin matters.
- Backend does not see HTTPS/proxy correctly: set `TRUST_PROXY=true` and expose through Cloudflare HTTPS only.
- `trycloudflare.com` does not start: Cloudflare notes Quick Tunnels may not work when a `config.yaml` exists in the user `.cloudflared` directory; temporarily rename that local file.
- Backend cannot connect to MongoDB from Docker: use Atlas allowlisting for the dev machine's current public IP or a host-only local URI such as `mongodb://host.docker.internal:27017/agent-lottery`.
