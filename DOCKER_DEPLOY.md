# Docker Deploy

This setup runs the app as two containers:

- `web`: Caddy serves the built React app and proxies `/api/*` to `backend:5000`.
- `backend`: Node/Express API using the existing MongoDB connection string.

The frontend should keep `VITE_API_URL` empty in Docker so browser requests go to the same origin `/api`. This avoids the Render/Netlify CORS split.

## Local Smoke Test

```powershell
Copy-Item .env.docker.example .env.docker
# Edit .env.docker and set MONGODB_URI, JWT_SECRET, CRON_SYNC_TOKEN.
docker compose --env-file .env.docker up -d --build
docker compose logs -f
```

Open:

```text
http://localhost:8080
```

## Production VPS

Point your domain's DNS `A` record to the VPS IP, then set these values in `.env.docker`:

```env
APP_SITE_ADDRESS=your-domain.com
PUBLIC_ORIGIN=https://your-domain.com
HTTP_PORT=80
HTTPS_PORT=443
VITE_API_URL=
```

Then deploy:

```bash
docker compose --env-file .env.docker up -d --build
docker compose ps
docker compose logs -f backend
```

Caddy will request and renew HTTPS certificates automatically when `APP_SITE_ADDRESS` is a real domain and ports `80`/`443` are reachable.

## Required Backend Secrets

Set real values in `.env.docker` before production:

```env
MONGODB_URI=...
JWT_SECRET=...
CRON_SYNC_TOKEN=...
```

If using MongoDB Atlas, allow the VPS public IP in Atlas Network Access.

## Operational Commands

```bash
docker compose --env-file .env.docker exec backend npm run production:preflight
docker compose --env-file .env.docker exec backend npm run legacy:cleanup:validate
docker compose --env-file .env.docker exec backend npm run db:backup -- --tag=manual
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d --build
```

## Easier Alternatives

If you do not want to manage raw Docker commands, use a VPS panel that can deploy Docker Compose, such as Coolify or Dokploy. Keep this same `docker-compose.yml`, `.env.docker`, and domain setup. That is usually the easiest replacement for Render + Netlify while keeping control on your own VPS.
