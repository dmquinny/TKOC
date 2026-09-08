# The Kingdoms of Chaos

Modern Next.js implementation of The Kingdoms of Chaos, backed by MySQL,
Prisma, and a persistent hourly tick worker.

## Local verification

```sh
npm ci
npm run verify
npm run build
```

`npm run verify` runs the Prisma schema check, TypeScript, ESLint, the unit
tests, and the three legacy invariant suites. `npm run test:unit` on its own
runs the fast unit tests under `tests/`.

`npm run test:db` is an optional integration check. It uses the configured
database, creates one temporary rate-limit row, verifies concurrent updates,
and removes the row.

## Local development

The git-ignored `.env` points the app at a local database on
`127.0.0.1:3307` (`root` / `tkoc`, database `tkoc`). Any MySQL 8 or MariaDB
10.6+ works; the portable MariaDB zip from archive.mariadb.org needs no
install (`mysql_install_db --datadir=... --password=tkoc --port=3307`, then
`mysqld --datadir=... --port=3307 --console`). Then:

```sh
npx prisma migrate deploy
npx prisma db seed
npx next dev --webpack
```

Use the `--webpack` flag for both `next dev` and `next build` on the `W:`
share; Turbopack cannot create the junctions it needs on a network drive.
To force a tick locally, set `GameState.nextTickAt` to a past time and call
`POST /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`.

## Updating the live game

The application folder on this machine (`W:\tkoc-modern`) is the same folder
the Docker host mounts at `/mnt/Apps/Apps/tkoc-modern`, so there is nothing
to copy. After editing, run one command from the project folder:

```powershell
npm run update
```

This runs the local checks, connects to the host over SSH, and runs
`scripts/update.sh` there. On the host the script:

1. keeps the current image as `tkoc-modern:rollback`;
2. rebuilds the images, reusing cached layers (a code-only change rebuilds in
   a fraction of the original time because dependencies are cached);
3. checks whether any Prisma migration is still unapplied;
4. if one is pending, pauses the game, backs up MySQL, migrates, reseeds the
   reference data, and verifies the database guard; otherwise it simply
   recreates the containers on the new image, which takes seconds;
5. waits for `/api/health` and restores the previous image automatically if
   the new build does not become healthy.

First-time setup on the Windows side: copy `deploy.config.example.json` to
`deploy.config.json` and set `sshTarget` to your host login (for example
`root@192.168.1.2`). The file is ignored by git and Docker. Passing
`-Target user@host` or setting `TKOC_SSH_TARGET` works too.

Useful variants:

```powershell
npm run update -- -Full          # always back up, migrate, and reseed
npm run update -- -SkipChecks    # skip the local tsc/eslint/unit run
npm run update -- -SkipBuild     # restart on the already-built image
```

On the host itself:

```sh
sh scripts/update.sh             # same as npm run update, without local checks
sh scripts/status.sh             # containers, images, health, scheduler log
sh scripts/rollback.sh           # bring back the previous build
```

`scripts/deploy-production.sh` remains the original full deployment and is
what `--full` reproduces.

## Control panel

`control/` is a small standalone service for administrators: start, stop,
restart, update, roll back, and prune the game containers from a browser,
with host load, memory, disk, per-container statistics, the live game clock,
streamed action output, and container logs. It signs you in with your normal
game administrator account and keeps working while the game itself is down.
It is defined as `tkoc-control` in the server's root `docker-compose.yml`
beside the database. Start it once on the host and it stays up across game
updates:

```sh
npm run control:up        # docker compose -f ../docker-compose.yml up -d --build tkoc-control
```

Then open `http://<host>:3401`. Details and configuration are in
[control/README.md](control/README.md).

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

## Project layout

- `src/app/dashboard/layout.tsx` checks the session cookie once and renders
  the sidebar and content column for every game screen.
- `src/lib/client/useGameData.ts` is the one fetch hook every page uses; it
  handles loading, errors, expired sessions, and missing provinces.
- `src/styles/` holds the stylesheet split by concern; `tokens.css` defines
  every colour and font so pages never use literal values.
- `src/lib/server/` holds database helpers shared by several routes
  (targets, battle reports, activity, rankings).
- Pure game helpers (`combat.ts`, `targets.ts`, `apocalypse.ts`,
  `forecast.ts`, `checklist.ts`, `ranking.ts`) are covered by `tests/`.
