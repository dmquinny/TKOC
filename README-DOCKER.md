# TKOC production deployment

This bundle is designed for the existing `tkoc-db` MySQL 8 container in the
server's root Docker Compose file. It adds two host-networked containers:

- `tkoc-web` — Next.js on `127.0.0.1:3400`
- `tkoc-tick` — the single scheduler, polling the durable tick endpoint

Do **not** run the old `src/lib/engine.ts` loop. It is a one-minute development
prototype and does not contain the complete game rules.

## Persistent storage

The replaceable application bundle lives in `/mnt/Apps/Apps/tkoc-modern`. All
runtime state and secrets live under the persistent appdata share:

```text
/mnt/Apps/Apps/appdata/
|-- tkoc-db/                         MySQL data directory
`-- tkoc-modern/
    |-- mysql.env                    MySQL root and application credentials
    |-- .env.production              Game, authentication, and tick settings
    `-- backups/                     Database and configuration backups
```

On the Windows share these paths are `W:\appdata\tkoc-db` and
`W:\appdata\tkoc-modern`. The web and tick containers are stateless; gameplay,
accounts, tick history, and seeded game configuration are stored in MySQL. There
are no application uploads or other runtime files outside appdata.

## First deployment with the existing database

On the server:

```sh
cd /mnt/Apps/Apps/tkoc-modern
docker compose -f ../docker-compose.yml up -d tkoc-db
sh scripts/rotate-mysql-passwords.sh
docker compose -f compose.production.yaml --profile tools build
docker compose -f compose.production.yaml --profile tools run --rm migrate npm run db:baseline
docker compose -f compose.production.yaml --profile tools run --rm migrate npm run db:deploy
docker compose -f compose.production.yaml up -d web tick
```

At each password prompt, press Enter to generate a separate 64-character
secret, or enter a separate URL-safe password of at least 32 characters. The
rotation utility creates persistent `mysql.env` and `.env.production` files
under appdata and takes a database backup before changing either credential. It
also changes the root Compose `tkoc-db` service from inline passwords to the
persistent `mysql.env` file.

`db:baseline` is a one-time command for the existing database, whose tables
predate Prisma migration history. Never run it for later migrations. For a new,
empty database, skip `db:baseline`, run `db:deploy`, then run `npm run db:seed`.

The first scheduler poll initializes `nextTickAt` to the next whole UTC hour.
Thereafter that database timestamp is authoritative. Restarts do not move it;
one due tick is processed when service resumes and older missed wall-clock slots
are skipped, preventing a burst of offline production or an endless backlog.

The temporary **Start Fresh** control in Administration is enabled by default.
Set `ENABLE_ADMIN_START_FRESH=false` in `.env.production` and recreate `web` to
hide the button and reject the reset action when launch cleanup is finished.

## Rotate MySQL credentials

Changing `MYSQL_PASSWORD` in Compose alone does not change an account in an
existing MySQL data directory. Use the rotation utility from the Docker server:

```sh
cd /mnt/Apps/Apps/tkoc-modern
sh scripts/rotate-mysql-passwords.sh
```

Enter separate passwords of at least 32 URL-safe characters, or press Enter at
each prompt to generate separate 64-character secrets. The utility changes the
live `tkoc` and `root` accounts, writes the persistent appdata configuration,
updates the root Compose file, recreates MySQL, verifies the application login,
and restarts the web and tick containers when they already exist. Inputs and
generated passwords are never printed. A database backup is taken before either
live account is changed.

The utility creates timestamped, mode-600 configuration and database backups in
`W:\appdata\tkoc-modern\backups`. Delete obsolete rotation backups after the new
credentials and a fresh scheduled database backup have been verified.

## Verify before exposing the site

```sh
docker compose -f compose.production.yaml ps
curl -fsS http://127.0.0.1:3400/api/health
docker logs --tail 100 tkoc-tick
docker exec tkoc_db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT age,tick,lastTickAt,nextTickAt,lastTickDurationMs FROM GameState; SELECT age,tick,scheduledFor,completedAt,durationMs FROM TickRun ORDER BY id DESC LIMIT 10;"'
```

The public health response should report `database: "connected"`. Sign in as an
administrator and open **Administration → System Health** to confirm a future
`nextTickAt` and no growing tick delay. Detailed scheduler timestamps are only
returned to authenticated administrators. Exactly one `TickRun` row should be
created for each scheduled hour.

Point Nginx Proxy Manager at `127.0.0.1:3400` and enable HTTPS. Production auth
cookies are secure and will not work correctly over plain HTTP.

## Normal updates

The bundle directory is the Windows share, so edits made on `W:\tkoc-modern`
are already on the host. Run `npm run update` from Windows (see README.md for
the one-time `deploy.config.json` setup), or on the host:

```sh
cd /mnt/Apps/Apps/tkoc-modern
sh scripts/update.sh
```

The script keeps the current image as `tkoc-modern:rollback`, rebuilds the
images with cached layers, applies pending migrations only when there are any
(taking a backup first), restarts the containers, and rolls back automatically
if `/api/health` does not come up. Use `sh scripts/update.sh --full` to force
the backup, migration, and seed steps, `sh scripts/status.sh` to inspect the
running game, and `sh scripts/rollback.sh` to restore the previous build by
hand.

## Backup

Run this before every deployment and on a daily schedule. Keeping these backups
under appdata means they remain with the rest of the persistent TKOC state:

```sh
mkdir -p /mnt/Apps/Apps/appdata/tkoc-modern/backups
docker exec tkoc_db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --triggers -uroot "$MYSQL_DATABASE"' | gzip > "/mnt/Apps/Apps/appdata/tkoc-modern/backups/tkoc-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
```

Periodically restore a backup into a separate test database; an untested backup
is not a recovery plan.

## Recovery after a server rebuild

Restore the `W:\appdata` folder and root `docker-compose.yml`, copy a fresh
`tkoc-modern` application bundle beside appdata, then run:

```sh
cd /mnt/Apps/Apps/tkoc-modern
docker compose -f ../docker-compose.yml up -d tkoc-db
docker compose -f compose.production.yaml --profile tools build
docker compose -f compose.production.yaml --profile tools run --rm migrate npm run db:deploy
docker compose -f compose.production.yaml up -d web tick
```

Do not run `db:baseline` during recovery: its migration history is already in
the restored MySQL data directory.

## Existing root Compose hardening

The root `docker-compose.yml` currently publishes MySQL on every interface.
Unless another machine genuinely needs direct database access, change:

```yaml
ports:
  - "3306:3306"
```

to:

```yaml
ports:
  - "127.0.0.1:3306:3306"
```

Then recreate only `tkoc-db`. Do not remove its persistent data directory.
