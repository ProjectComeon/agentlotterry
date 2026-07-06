# Backup And Restore Runbook

This repo includes MongoDB backup and restore scripts under `backend/src/scripts`. Backups use EJSON files plus collection index metadata. Restore reads existing EJSON array backups with a streaming parser and inserts in batches.

## Backup

Full backup:

```bash
cd backend
npm run db:backup -- --tag=manual
```

Pre-deploy backup:

```bash
cd backend
npm run db:backup -- --tag=predeploy
```

Selected collections:

```bash
cd backend
npm run db:backup -- --tag=predeploy --collections=users,betslips,betitems,creditledgerentries
```

Operational requirements:

- Store backups outside the repo in production, for example `BACKUP_DIR=/var/backups/agent-lottery`.
- Encrypt backups at rest when storage is outside the database provider.
- Restrict backup read access to operators who can also access production data.
- Do not commit backup archives or `.ejson` production data.
- Monitor backup job failures.
- Periodically verify backup size and expected collection counts.

## Restore

Non-destructive restore into existing collections:

```bash
cd backend
npm run db:restore -- --path=backups/<timestamp>_manual
```

Destructive restore requires both `--drop` and `--yes`:

```bash
cd backend
npm run db:restore -- --path=backups/<timestamp>_manual --drop --yes
```

Selected collections:

```bash
cd backend
npm run db:restore -- --path=backups/<timestamp>_manual --collections=users,betslips,betitems
```

Restore guardrails:

- `--drop` without `--yes` must fail.
- Destructive restore takes a pre-restore backup by default.
- Do not use `--skip-pre-restore-backup` unless the incident commander explicitly approves it.
- Restore to staging first when possible.
- Confirm collection counts, indexes, login, wallet balances, and representative slips after restore.
- Do not restore over production while web traffic is still writing unless the incident plan explicitly allows downtime.

## Restore Test

At least once per release cycle:

1. Take a fresh backup from staging or sanitized production data.
2. Restore into an isolated database.
3. Run:

```bash
cd backend
npm run production:preflight
npm run e2e:smoke
npm run e2e:regression
```

4. Record the backup path, restore target, command output, operator, and date.

## Retention Cleanup

Available scripts:

```bash
cd backend
npm run retention:cleanup:dry
npm run retention:cleanup:apply
```

Production rules:

- Run dry mode first.
- Confirm `RETENTION_KEEP_PREVIOUS_MONTHS` matches legal and operational retention requirements.
- Take a backup before apply mode.
- Do not run cleanup concurrently with a destructive restore.
- Review cleanup logs and collection counts afterward.
