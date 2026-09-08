#!/bin/sh
# Quick look at the running game: containers, health, and the scheduler log.
#
#   sh scripts/status.sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_DIR"

COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
HEALTH_URL=${TKOC_HEALTH_URL:-http://127.0.0.1:3400/api/health}

echo "==> Containers"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "==> Images"
docker image ls tkoc-modern --format 'table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'

echo
echo "==> Health"
curl -fsS "$HEALTH_URL" 2>/dev/null && echo || echo "The health endpoint did not respond."

echo
echo "==> Scheduler (last 15 lines)"
docker logs --tail 15 tkoc-tick 2>&1 || true
