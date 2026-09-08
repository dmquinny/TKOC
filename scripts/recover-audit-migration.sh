#!/bin/sh
set -eu

if [ "${1:-}" != "--confirm" ]; then
  echo "This only recovers the exact query-7 failure of 20260726090000_audit_hardening." >&2
  echo "Run with --confirm after verifying Prisma reported MySQL error 1553." >&2
  exit 2
fi

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_DIR"

COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
DB_CONTAINER=${TKOC_DB_CONTAINER:-tkoc_db}
BACKUP_DIR=${BACKUP_DIR:-../appdata/tkoc-modern/backups}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/tkoc-before-audit-recovery-$STAMP.sql.gz"
RAW_BACKUP="$BACKUP_DIR/.tkoc-before-audit-recovery-$STAMP.sql"

cleanup() {
  rm -f "$RAW_BACKUP"
}
trap cleanup EXIT HUP INT TERM

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

mkdir -p "$BACKUP_DIR"
MIGRATION_STATE=$(docker exec "$DB_CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -uroot "$MYSQL_DATABASE" -e "
    SELECT CASE
      WHEN finished_at IS NULL AND rolled_back_at IS NULL THEN '\''failed'\''
      WHEN finished_at IS NOT NULL THEN '\''applied'\''
      ELSE '\''rolled-back'\''
    END
    FROM _prisma_migrations
    WHERE migration_name = '\''20260726090000_audit_hardening'\''
    ORDER BY started_at DESC
    LIMIT 1;"')

if [ "$MIGRATION_STATE" != "failed" ]; then
  echo "Recovery refused: the latest audit migration state is '${MIGRATION_STATE:-missing}', not failed." >&2
  echo "If Prisma reports no pending migrations, run only: sh scripts/deploy-production.sh" >&2
  exit 1
fi

PARTIAL_OBJECTS=$(docker exec "$DB_CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -uroot "$MYSQL_DATABASE" -e "
    SELECT
      (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '\''User'\'' AND COLUMN_NAME = '\''sessionVersion'\'') +
      (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '\''Province'\'' AND COLUMN_NAME IN ('\''status'\'', '\''attackPressure'\'')) +
      (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '\''User'\'' AND INDEX_NAME IN ('\''User_username_key'\'', '\''User_email_key'\'')) +
      (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '\''Province'\'' AND INDEX_NAME = '\''Province_provinceName_key'\'');"')

if [ "$PARTIAL_OBJECTS" != "6" ]; then
  echo "Recovery refused: the database is not in the expected query-7 partial state ($PARTIAL_OBJECTS/6 objects found)." >&2
  echo "No containers were stopped and no schema changes were made." >&2
  exit 1
fi

echo "Building the current migration tool..."
compose --profile tools build migrate

echo "Stopping web and tick while the partial schema is repaired..."
compose stop tick
compose stop web

echo "Creating recovery backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --triggers -uroot "$MYSQL_DATABASE"' \
  > "$RAW_BACKUP"
test -s "$RAW_BACKUP"
gzip -c "$RAW_BACKUP" > "$BACKUP_FILE"
test -s "$BACKUP_FILE"

echo "Rolling back only the columns and indexes committed before query 7..."
docker exec -i "$DB_CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"' \
  < prisma/recovery/20260726090000_rollback_partial.sql

echo "Marking the failed Prisma migration rolled back..."
compose --profile tools run --rm migrate \
  npx prisma migrate resolve --rolled-back 20260726090000_audit_hardening

echo "Recovery completed. Backup retained at $BACKUP_FILE"
echo "Web and tick remain stopped. Run: npm run deploy:production"
