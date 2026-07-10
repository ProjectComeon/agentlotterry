# Security Checklist

This checklist covers baseline production exposure and application security controls for Agent Lottery.

## Network Exposure

- [ ] Public traffic enters only through HTTPS.
- [ ] Reverse proxy or load balancer is the only public web entrypoint.
- [ ] Backend port is private when using a reverse proxy, and `BACKEND_HOST` is set to a private bind host when the runtime supports it.
- [ ] MongoDB is not public.
- [ ] Backup storage is not public.
- [ ] Admin-only internal ports are not public.
- [ ] Cloudflare Quick Tunnel is not used for production.
- [ ] Named tunnels, if used, are managed and credentials stay outside the repo.

## CORS, Cookies, And CSRF

- [ ] `FRONTEND_URL` is the exact public frontend origin.
- [ ] CORS is never `*` in production.
- [ ] `NODE_ENV=production` so auth cookies are `Secure`.
- [ ] `TRUST_PROXY=true` behind HTTPS proxies.
- [ ] `agentlottery_auth` is `HttpOnly`.
- [ ] `agentlottery_csrf` exists and unsafe writes include `X-CSRF-Token`.
- [ ] CSRF middleware remains enabled.
- [ ] Browser storage does not contain bearer/access tokens.
- [ ] Logout clears auth and CSRF cookies.

## Secrets

- [ ] `.env` files are not committed.
- [ ] `MONGODB_URI` is stored only in the deployment secret manager.
- [ ] `JWT_SECRET` is strong, unique, and rotated if exposed.
- [ ] `CRON_SYNC_TOKEN` is strong, unique, and known only to the scheduler.
- [ ] Cloudflare tunnel credentials and private keys are outside the repo.
- [ ] Preview/demo passwords are not reused in production.
- [ ] Admin bootstrap/default passwords are rotated before launch.

## Roles And Data Isolation

- [ ] Anonymous users cannot access protected APIs.
- [ ] Member role cannot access admin or agent APIs.
- [ ] Member can see only own wallet, slips, pending payouts, and notifications.
- [ ] Agent can see only assigned members and own pending payouts.
- [ ] Admin pending payout UI does not include manual pay-for-agent override.
- [ ] Member UI does not send `customerId`, `agentId`, `actorUser`, or `placedBy`.
- [ ] Legacy member slip endpoints remain forbidden.

## Financial Safety

- [ ] Member submit debits member credit immediately.
- [ ] Draft does not debit credit.
- [ ] Duplicate submit with same `clientRequestId` debits once.
- [ ] Agent held stake increases on submit.
- [ ] Cancel before close refunds member and reverses held stake.
- [ ] Agent balance does not go negative.
- [ ] Pending payout is created when agent available credit is insufficient.
- [ ] Admin top-up auto-pays pending payout FIFO.
- [ ] Settlement reruns do not double-pay.

## Operational Monitoring

- [ ] Alert on `/api/ready` failures.
- [ ] Alert on elevated 5xx rate.
- [ ] Alert on repeated login, CSRF, or authorization failures.
- [ ] Alert on MongoDB reconnect/timeouts.
- [ ] Alert on backup failure.
- [ ] Alert on result sync failure.
- [ ] Review logs without exposing cookies, JWTs, passwords, MongoDB URIs, or cron tokens.
