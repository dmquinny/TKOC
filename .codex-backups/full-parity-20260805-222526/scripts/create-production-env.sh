#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_dir=$(dirname "$script_dir")
config_dir=${TKOC_CONFIG_DIR:-"$app_dir/../appdata/tkoc-modern"}
target="${1:-$config_dir/.env.production}"

mkdir -p -- "$(dirname -- "$target")"
if [ -e "$target" ]; then
  echo "$target already exists; refusing to overwrite it."
  exit 1
fi

printf 'Existing TKOC MySQL password: '
stty -echo
IFS= read -r db_password
stty echo
printf '\n'

case "$db_password" in
  *[!A-Za-z0-9._~-]*)
    echo 'The password contains URL-reserved characters.'
    echo 'Percent-encode it and create .env.production from .env.production.example manually.'
    exit 1
    ;;
esac

if [ "${#db_password}" -lt 32 ]; then
  echo 'The database password must be at least 32 characters.'
  exit 1
fi

random_hex() {
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

umask 077
cat > "$target" <<EOF
DATABASE_URL=mysql://tkoc:${db_password}@127.0.0.1:3306/tkoc
JWT_SECRET=$(random_hex)
CRON_SECRET=$(random_hex)
TICK_INTERVAL_SECONDS=3600
TICK_POLL_SECONDS=30
TICK_MAX_CATCH_UP=24
ENABLE_ADMIN_START_FRESH=true
PORT=3400
EOF

echo "Created $target with mode 600 and fresh application secrets."
