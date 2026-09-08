#!/bin/sh
# Bring back the previous application image after a bad update.
#
#   sh scripts/rollback.sh
#
# Only the application containers are rolled back. Database migrations are
# forward-only; if an update migrated the schema, restore the matching backup
# from ../appdata/tkoc-modern/backups before running the old build.
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_DIR"

COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
HEALTH_URL=${TKOC_HEALTH_URL:-http://127.0.0.1:3400/api/health}
IMAGE=tkoc-modern:local
ROLLBACK_IMAGE=tkoc-modern:rollback

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1 \
  || { echo "No rollback image is available. Run an update first." >&2; exit 1; }

echo "==> Restoring $ROLLBACK_IMAGE as $IMAGE"
docker tag "$IMAGE" "tkoc-modern:failed-$(date -u +%Y%m%dT%H%M%SZ)" 2>/dev/null || true
docker tag "$ROLLBACK_IMAGE" "$IMAGE"
compose up -d --force-recreate web tick

echo "==> Waiting for the application to report healthy"
attempt=1
while [ "$attempt" -le 20 ]; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Rolled back and healthy."
    compose ps
    exit 0
  fi
  sleep 3
  attempt=$((attempt + 1))
done

echo "The previous build did not become healthy either. Check 'docker logs tkoc-web'." >&2
exit 1
