#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_DIR"

COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
DB_CONTAINER=${TKOC_DB_CONTAINER:-tkoc_db}
BACKUP_DIR=${BACKUP_DIR:-../appdata/tkoc-modern/backups}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/tkoc-before-deploy-$STAMP.sql.gz"
RAW_BACKUP="$BACKUP_DIR/.tkoc-before-deploy-$STAMP.sql"
APP_STOPPED=0
MIGRATION_STARTED=0

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

finish() {
  status=$?
  trap - EXIT HUP INT TERM
  rm -f "$RAW_BACKUP"
  if [ "$status" -ne 0 ] && [ "$APP_STOPPED" -eq 1 ]; then
    if [ "$MIGRATION_STARTED" -eq 0 ]; then
      echo "Deployment stopped before migrations; restoring the previous application." >&2
      if docker image inspect tkoc-modern:rollback >/dev/null 2>&1; then
        docker tag tkoc-modern:rollback tkoc-modern:local
      fi
      compose up -d web tick
    else
      echo "A migration or database verification failed. Web and tick remain stopped to protect the world." >&2
      echo "Inspect the migration error and retain the backup at $BACKUP_FILE." >&2
    fi
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM

mkdir -p "$BACKUP_DIR"

if docker image inspect tkoc-modern:local >/dev/null 2>&1; then
  docker tag tkoc-modern:local tkoc-modern:rollback
fi

echo "Building web, tick, and migration images..."
compose --profile tools build

echo "Pausing the game for a consistent backup and migration..."
compose stop tick
compose stop web
APP_STOPPED=1

echo "Creating database backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --triggers -uroot "$MYSQL_DATABASE"' \
  > "$RAW_BACKUP"
test -s "$RAW_BACKUP"
gzip -c "$RAW_BACKUP" > "$BACKUP_FILE"
test -s "$BACKUP_FILE"

echo "Applying database migrations..."
MIGRATION_STARTED=1
compose --profile tools run --rm migrate npm run db:deploy

echo "Verifying database concurrency safeguards..."
compose --profile tools run --rm migrate npm run test:db

echo "Starting the application..."
compose up -d --force-recreate web tick
APP_STOPPED=0

attempt=1
while [ "$attempt" -le 20 ]; do
  if curl -fsS http://127.0.0.1:3400/api/health >/dev/null; then
    echo "Deployment healthy. Backup retained at $BACKUP_FILE"
    compose ps
    exit 0
  fi
  sleep 3
  attempt=$((attempt + 1))
done

echo "Health check failed after 60 seconds." >&2
if docker image inspect tkoc-modern:rollback >/dev/null 2>&1; then
  echo "Restoring the previous application image..." >&2
  docker tag tkoc-modern:rollback tkoc-modern:local
  compose up -d --force-recreate web tick
fi
echo "Database migrations are forward-only; the backup is $BACKUP_FILE" >&2
exit 1
