# Production Deployment

This runbook is for a real production deployment of Agent Lottery. It is not a preview or demo path. Do not use Cloudflare Quick Tunnel as production infrastructure.

## Supported App Shape

- Backend: Node/Express API under `/api`, default `PORT=5000`; optional `BACKEND_HOST` can restrict the bind host when the private interface is known.
- Frontend: Vite React static build.
- Recommended public shape: one HTTPS web origin that serves the frontend and reverse-proxies `/api` to the backend.
- Database: MongoDB reachable from the backend only. Do not expose MongoDB to the public internet.
- Auth: httpOnly `agentlottery_auth` cookie plus CSRF cookie/header.
- Cookie security: auth cookie `Secure` is enabled by `NODE_ENV=production`; there is no separate `COOKIE_SECURE` env flag today.
- CSRF tokens are issued per login/session; there is no separate `CSRF_SECRET` env variable today.
- CORS: backend uses `FRONTEND_URL` as the allowed origin. In production this must be the exact public HTTPS origin, never `*`.

## Required Production Environment

Use a secret manager or host-level env vars. Do not commit filled `.env` files.

Minimum required backend values:

```env
NODE_ENV=production
PORT=5000
# Optional. Use only when the deployment topology has a known private bind host.
BACKEND_HOST=
TRUST_PROXY=true
FRONTEND_URL=https://app.example.com
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/agent-lottery
JWT_SECRET=replace-with-a-long-random-production-secret
AUTO_SEED_ADMIN=false
AUTO_SEED_CATALOG=false
HEALTH_EXPOSE_DETAILS=false
LOG_FORMAT=combined
BACKUP_DIR=/var/backups/agent-lottery
AUTO_SYNC_RESULTS=false
CRON_SYNC_TOKEN=replace-with-a-long-random-production-cron-token
```

Frontend build:

```env
# Same-origin reverse proxy
VITE_API_URL=

# Split-origin only, if unavoidable
VITE_API_URL=https://api.example.com
```

`CRON_SYNC_TOKEN` is required in production when `AUTO_SYNC_RESULTS=false`. Send it to the cron endpoint with `X-Cron-Token` or `Authorization: Bearer <token>`.

## Deployment Topology

Recommended same-origin topology:

```text
https://app.example.com
  /        -> frontend static build
  /api/*   -> backend http://backend:5000/api/*
MongoDB    -> private network / Atlas restricted access
```

Rules:

- Terminate HTTPS at the load balancer or reverse proxy.
- Forward `X-Forwarded-Proto` and `X-Forwarded-Host`.
- Keep `TRUST_PROXY=true` behind HTTPS proxies.
- Do not expose the backend port directly to the public internet when a reverse proxy is available.
- Bind the backend to a private interface or localhost when your host/proxy topology supports it; leave `BACKEND_HOST` empty for platforms that inject their own listener interface.
- Do not expose MongoDB, backup storage, admin-only internal ports, or local dev servers.

## Build And Start

Backend:

```bash
cd backend
npm ci --omit=dev
npm run production:preflight
npm start
```

Frontend:

```bash
cd frontend
npm ci
npm run build
```

Serve `frontend/dist` from the reverse proxy or static host. If the frontend and backend are split across origins, rebuild the frontend with `VITE_API_URL` set to the exact backend origin, without `/api`.

## Health Checks

Existing read-only endpoints:

- `GET /api/health`: process startup/database status.
- `GET /api/ready`: readiness for traffic; returns `503` until startup is complete and MongoDB is connected.

Production settings:

- Keep `HEALTH_EXPOSE_DETAILS=false`.
- Point load balancer readiness checks at `/api/ready`.
- Keep health endpoints unauthenticated but do not expose internal stack traces or secrets.

## Required Validation Before Traffic

Run from the deployed environment or a staging environment with production-like env:

```bash
cd backend
npm run production:preflight
npm run e2e:smoke
npm run e2e:regression
```

Also verify:

- `npm audit --omit=dev` passes in backend and frontend.
- `npm run lint` passes in backend and frontend.
- `npm run build` passes in frontend.
- `AUTO_SEED_ADMIN=false` and `AUTO_SEED_CATALOG=false`.
- At least one active admin account exists and the admin password has been rotated.

## Result Sync

Preferred production setup:

- Keep `AUTO_SYNC_RESULTS=false` on web instances.
- Run an external scheduler that POSTs `/api/lottery/sync-latest/cron`.
- Use `CRON_SYNC_TOKEN` as the shared secret.
- Alert if scheduled sync fails repeatedly or returns non-2xx.

## Logging And Monitoring

Baseline monitoring:

- HTTP 5xx rate and latency.
- `/api/ready` status.
- MongoDB connection state and query latency.
- Disk capacity for backup storage.
- Backup job success/failure.
- Restore test date and result.
- Cron result sync success/failure.

Logging:

- Keep `LOG_FORMAT=combined` or an equivalent platform access log.
- Preserve `requestId` in application logs.
- Do not log JWTs, cookies, MongoDB URIs, passwords, or cron tokens.
- Define log retention before launch.

## Production Prohibitions

Do not use these in production:

- Cloudflare Quick Tunnel / `trycloudflare.com`.
- Wildcard CORS.
- Public MongoDB.
- Public backend port when a reverse proxy is available.
- Real `.env`, tunnel credentials, private keys, backup archives, or database URIs committed to the repo.
- `AUTO_SEED_ADMIN=true` or `AUTO_SEED_CATALOG=true`.
- Development defaults such as `admin/admin123` or known JWT secrets.
