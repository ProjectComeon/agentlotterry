# Production Checklist

## Before first deploy
- Copy [backend/.env.example](/C:/Users/slovv/Desktop/Job%20Activeincome/AdminAgentLotterry/backend/.env.example) to `.env` on the target environment.
- Set a strong `JWT_SECRET`.
- Set `FRONTEND_URL` to the real frontend origin.
- Set `AUTO_SEED_ADMIN=false` after the first controlled bootstrap.
- Set `AUTO_SEED_CATALOG=false` on production web instances.
- For multi-user or multi-instance production, set `AUTO_SYNC_RESULTS=false` on the web service.
- Set `CRON_SYNC_TOKEN` to a long random value.
- Run `npm run catalog:seed`.
- Configure an external cron to call `POST /api/lottery/sync-latest/cron`.
- Confirm at least one active admin account exists in MongoDB.
- Run `npm run production:preflight`.

## Before every deploy
- Run `npm run legacy:cleanup:validate`.
- Run `npm run catalog:seed`.
- Run `npm run e2e:smoke`.
- Run `npm run e2e:regression`.
- Run `npm run db:backup -- --tag=predeploy`.
- Verify `/api/health` and `/api/ready` on the current environment.
- If external cron is enabled, verify `POST /api/lottery/sync-latest/cron` with `X-Cron-Token` returns `200`.
- Do not enable in-process `AUTO_SYNC_RESULTS` on more than one web instance unless you add a distributed lock.

## After deploy
- Verify `/api/health` returns `ok`.
- Verify `/api/ready` returns `ready=true`.
- Log in with `admin`, `agent`, and `member` test accounts.
- Check wallet transfer, member bet submit, and result read flow.
- Review server logs for request IDs tied to any 4xx/5xx spikes.

## External cron example
```bash
curl -X POST https://your-backend.example.com/api/lottery/sync-latest/cron \
  -H "X-Cron-Token: <CRON_SYNC_TOKEN>"
```

## Recommended production mode
- Catalog/bootstrap: `AUTO_SEED_CATALOG=false` and run `npm run catalog:seed` during deploy
- Web/API instances: `AUTO_SYNC_RESULTS=false`
- One external scheduler: call `/api/lottery/sync-latest/cron` every 5 minutes
- Keep `RESULT_SYNC_INTERVAL_MS` only for single-instance or local development

## Rollback trigger
- `/api/ready` stays `503`
- login fails across multiple roles
- wallet ledger writes fail
- result settlement produces wrong `wonAmount`
- agent reports diverge from submitted items

## Rollback baseline
- restore the previous app build
- restore the latest database backup if data migration caused the issue
- rerun `npm run production:preflight`
