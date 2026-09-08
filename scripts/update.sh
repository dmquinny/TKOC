#!/bin/sh
# One-command update of the running game on the Docker host.
#
#   sh scripts/update.sh            fast path (see below)
#   sh scripts/update.sh --full     always back up, migrate, seed, and verify
#   sh scripts/update.sh --skip-build
#   sh scripts/update.sh --no-prune
#
# Fast path: rebuild the images (layer cache makes this quick), detect whether
# any Prisma migration is still unapplied, and only when one is pending stop
# the game, take a backup, migrate, and seed. Otherwise the containers are
# simply recreated on the new image, which takes a few seconds. Either way the
# previous image is kept as tkoc-modern:rollback and restored automatically if
# the new build does not become healthy.
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_DIR"

COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
DB_CONTAINER=${TKOC_DB_CONTAINER:-tkoc_db}
ENV_FILE=${TKOC_ENV_FILE:-../appdata/tkoc-modern/.env.production}
BACKUP_DIR=${BACKUP_DIR:-../appdata/tkoc-modern/backups}
HEALTH_URL=${TKOC_HEALTH_URL:-http://127.0.0.1:3400/api/health}
IMAGE=tkoc-modern:local
ROLLBACK_IMAGE=tkoc-modern:rollback

FULL=0
SKIP_BUILD=0
PRUNE=1
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --no-prune) PRUNE=0 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/tkoc-before-update-$STAMP.sql.gz"
RAW_BACKUP="$BACKUP_DIR/.tkoc-before-update-$STAMP.sql"
APP_STOPPED=0
MIGRATION_STARTED=0
HAD_PREVIOUS_IMAGE=0

restore_previous_image() {
  if [ "$HAD_PREVIOUS_IMAGE" -eq 1 ] && docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
    echo "Restoring the previous application image..." >&2
    docker tag "$ROLLBACK_IMAGE" "$IMAGE"
    compose up -d --force-recreate web tick
  fi
}

finish() {
  status=$?
  trap - EXIT HUP INT TERM
  rm -f "$RAW_BACKUP"
  if [ "$status" -ne 0 ]; then
    if [ "$APP_STOPPED" -eq 1 ] && [ "$MIGRATION_STARTED" -eq 1 ]; then
      echo "A migration or database verification failed. Web and tick remain stopped to protect the world." >&2
      echo "Inspect the error above; the backup is $BACKUP_FILE. Run 'sh scripts/rollback.sh' to bring the previous build back." >&2
    elif [ "$APP_STOPPED" -eq 1 ]; then
      echo "Update stopped before migrations; restoring the previous application." >&2
      restore_previous_image
    fi
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' HUP INT TERM

# ---------- Preflight ----------
log "Checking the host"
command -v docker >/dev/null 2>&1 || { echo "docker is not installed or not on PATH." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is not available." >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "Missing $COMPOSE_FILE in $APP_DIR." >&2; exit 1; }
[ -f "$ENV_FILE" ] || {
  echo "Missing $ENV_FILE. Run 'sh scripts/create-production-env.sh' first." >&2
  exit 1
}
docker inspect --format '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q true \
  || { echo "The database container '$DB_CONTAINER' is not running." >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

# ---------- Pending migrations ----------
# Compares the migration folders in the bundle with the rows Prisma has
# recorded as applied. If the query fails for any reason the safe full path is
# taken so a migration is never silently skipped.
pending_migrations() {
  applied=$(docker exec "$DB_CONTAINER" sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" mysql -N -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL"' 2>/dev/null) \
    || return 2
  for dir in prisma/migrations/*/; do
    name=$(basename "$dir")
    case "$name" in [0-9]*) ;; *) continue ;; esac
    printf '%s\n' "$applied" | grep -qx "$name" || printf '%s\n' "$name"
  done
}

log "Checking for database migrations"
NEED_MIGRATION=0
if PENDING=$(pending_migrations); then
  if [ -n "$PENDING" ]; then
    NEED_MIGRATION=1
    echo "Pending migrations:"
    printf '  %s\n' $PENDING
  else
    echo "Database schema is up to date."
  fi
else
  NEED_MIGRATION=1
  echo "Could not read migration history; taking the full update path to be safe."
fi
if [ "$FULL" -eq 1 ]; then
  NEED_MIGRATION=1
  echo "Full update requested."
fi

# ---------- Build ----------
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker tag "$IMAGE" "$ROLLBACK_IMAGE"
  HAD_PREVIOUS_IMAGE=1
fi
if [ "$SKIP_BUILD" -eq 0 ]; then
  log "Building the application images (cached layers are reused)"
  compose --profile tools build
else
  log "Skipping the image build as requested"
fi

# ---------- Migration path ----------
if [ "$NEED_MIGRATION" -eq 1 ]; then
  log "Pausing the game for a consistent backup and migration"
  compose stop tick
  compose stop web
  APP_STOPPED=1

  log "Creating database backup: $BACKUP_FILE"
  docker exec "$DB_CONTAINER" sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --triggers -uroot "$MYSQL_DATABASE"' \
    > "$RAW_BACKUP"
  test -s "$RAW_BACKUP"
  gzip -c "$RAW_BACKUP" > "$BACKUP_FILE"
  test -s "$BACKUP_FILE"

  log "Applying database migrations"
  MIGRATION_STARTED=1
  compose --profile tools run --rm migrate npm run db:deploy

  log "Refreshing seeded reference data"
  compose --profile tools run --rm migrate npm run db:seed

  log "Verifying database concurrency safeguards"
  compose --profile tools run --rm migrate npm run test:db

  log "Starting the application"
  compose up -d --force-recreate web tick
  APP_STOPPED=0
else
  log "Restarting the application on the new image"
  compose up -d web tick
fi

# ---------- Health check ----------
log "Waiting for the application to report healthy"
attempt=1
while [ "$attempt" -le 20 ]; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Healthy after $attempt check(s)."
    if [ "$PRUNE" -eq 1 ]; then
      log "Removing dangling images"
      docker image prune -f >/dev/null 2>&1 || true
    fi
    log "Update complete"
    compose ps
    curl -fsS "$HEALTH_URL" 2>/dev/null && echo
    [ "$NEED_MIGRATION" -eq 1 ] && echo "Backup retained at $BACKUP_FILE"
    exit 0
  fi
  sleep 3
  attempt=$((attempt + 1))
done

echo "Health check failed after 60 seconds." >&2
docker logs --tail 60 tkoc-web >&2 || true
restore_previous_image
if [ "$NEED_MIGRATION" -eq 1 ]; then
  echo "Database migrations are forward-only; the pre-update backup is $BACKUP_FILE" >&2
fi
exit 1
