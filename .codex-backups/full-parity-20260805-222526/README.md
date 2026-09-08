# The Kingdoms of Chaos

Modern Next.js implementation of The Kingdoms of Chaos, backed by MySQL,
Prisma, and a persistent hourly tick worker.

## Local verification

```sh
npm ci
npm run verify
npm run build
```

`npm run test:db` is an optional integration check. It uses the configured
database, creates one temporary rate-limit row, verifies concurrent updates,
and removes the row.

## Production deployment

From the application directory on the server:

```sh
npm run deploy:production
```

The deployment script:

1. creates a timestamped MySQL backup;
2. retains the current application image as `tkoc-modern:rollback`;
3. builds the web, tick, and migration images;
4. applies Prisma migrations;
5. verifies the database-backed concurrency guard;
6. recreates the web and tick services;
7. checks `/api/health` and restores the previous application image if the
   new service does not become healthy.

Database migrations are forward-only. Backups are stored under
`../appdata/tkoc-modern/backups` unless `BACKUP_DIR` is set.

Required runtime values live in `../appdata/tkoc-modern/.env.production`.
At minimum configure `DATABASE_URL`, `JWT_SECRET`, and `CRON_SECRET`.

## Recovery from the July 2026 partial migration

Only use this when Prisma reports migration
`20260726090000_audit_hardening` failed at query 7 with MySQL error 1553.
The recovery SQL is deliberately scoped to that exact partial state:

```sh
npm run db:recover:audit
npm run deploy:production
```

The recovery command stops web and tick, takes a separate backup, rolls back
only the partial query-7 changes, and marks the failed Prisma attempt rolled
back. It deliberately leaves the app stopped until the normal deployment
succeeds. Do not rerun it after a successful migration.

## Useful operations

```sh
docker compose -f compose.production.yaml ps
docker logs --tail 200 tkoc-web
docker logs --tail 200 tkoc-tick
curl -fsS http://127.0.0.1:3400/api/health
```

Administrators can also inspect recent application errors, suspicious rate
limit activity, request references, and tick health from the in-game
Administration screen.
