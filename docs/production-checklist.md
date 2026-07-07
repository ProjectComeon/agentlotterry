# Production Checklist

Use this checklist for the final production gate. Every item should have an owner and evidence before traffic is allowed.

## Pre-Deploy

- [ ] Domain is final and uses HTTPS.
- [ ] Reverse proxy routes `/` to the frontend build and `/api/*` to the backend.
- [ ] Backend port is not public when the reverse proxy is used.
- [ ] MongoDB is not public and only backend infrastructure can connect.
- [ ] `NODE_ENV=production`.
- [ ] `TRUST_PROXY=true`.
- [ ] `FRONTEND_URL` is the exact public HTTPS origin.
- [ ] CORS is not wildcard.
- [ ] `AUTO_SEED_ADMIN=false`.
- [ ] `AUTO_SEED_CATALOG=false`.
- [ ] `JWT_SECRET` is strong, unique, and not reused from preview/dev.
- [ ] `CRON_SYNC_TOKEN` is strong and stored only in the scheduler/secret manager.
- [ ] `HEALTH_EXPOSE_DETAILS=false`.
- [ ] Real `.env` files, database URIs, tunnel tokens, private keys, and passwords are not committed.
- [ ] Admin password has been rotated away from bootstrap/default values.
- [ ] Catalog seed has been run intentionally if required.
- [ ] MongoDB indexes are built and ready.
- [ ] Backup storage exists and is writable.
- [ ] Backup schedule is configured.
- [ ] Restore procedure has been tested on non-production data.
- [ ] Log retention is configured.
- [ ] Alerts are configured for health/readiness failure, 5xx spikes, backup failure, and result sync failure.

## Pre-Deploy Commands

Backend:

```bash
cd backend
npm ci --omit=dev
npm audit --omit=dev
npm run lint
npm run production:preflight
npm run e2e:smoke
npm run e2e:regression
npm run db:backup -- --tag=predeploy
```

Frontend:

```bash
cd frontend
npm ci
npm audit --omit=dev
npm run lint
npm run test:security-guards
node scripts/testAuthBootstrap.mjs
node scripts/testApiReadCache.mjs
npm run build
```

Root:

```bash
git diff --check
```

## Go/No-Go

No-go if any of these are true:

- `production:preflight` reports `ok: false`.
- `AUTO_SEED_ADMIN` or `AUTO_SEED_CATALOG` is enabled.
- `FRONTEND_URL` is empty or does not match the real public origin.
- The database is reachable from the public internet.
- The backend port is public without an intentional API edge layer.
- A backup has not been taken before deploy.
- A rollback/restore path has not been reviewed.

## Post-Deploy Smoke

Run against the real production HTTPS URL with test accounts and low-value test data.

- [ ] `GET /api/health` returns healthy status.
- [ ] `GET /api/ready` returns `200`.
- [ ] Admin login/logout works.
- [ ] Agent login/logout works.
- [ ] Member login/logout works.
- [ ] Member dashboard loads open rounds.
- [ ] Member buy flow creates a draft before submit.
- [ ] Member submit debits member credit once.
- [ ] Duplicate submit with the same `clientRequestId` debits only once.
- [ ] Agent `heldStakeBalance` increases after submitted stake.
- [ ] Cancel before close refunds member credit and reverses held stake.
- [ ] Settlement lost releases held stake to agent available credit.
- [ ] Settlement won pays member when agent has enough available credit.
- [ ] Settlement won creates pending payout when agent has insufficient available credit.
- [ ] Pending payout notification appears for admin/agent/member.
- [ ] Admin top-up auto-pays pending payout FIFO.
- [ ] No bearer/access token appears in `localStorage` or `sessionStorage`.
- [ ] `agentlottery_auth` cookie is `HttpOnly` and `Secure`.
- [ ] Unsafe write requests include `X-CSRF-Token`.
- [ ] Deep route refresh works for `/member`, `/member/buy`, `/admin/pending-payouts`, and `/agent/pending-payouts`.
- [ ] Logout clears cookies and protected routes redirect to login.

## Post-Deploy Monitoring

Watch for at least the first operating window:

- 5xx responses.
- Login failures.
- CSRF failures.
- MongoDB reconnects or timeouts.
- Wallet/ledger errors.
- Pending payout auto-pay errors.
- Result sync errors.
- Backup job errors.
