#!/bin/sh
set -eu

umask 077

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_dir=$(dirname "$script_dir")
root_compose=${ROOT_COMPOSE_FILE:-"$app_dir/../docker-compose.yml"}
config_dir=${TKOC_CONFIG_DIR:-"$app_dir/../appdata/tkoc-modern"}
production_env=${PRODUCTION_ENV_FILE:-"$config_dir/.env.production"}
mysql_env=${MYSQL_ENV_FILE:-"$config_dir/mysql.env"}
app_compose="$app_dir/compose.production.yaml"
database_container=${DATABASE_CONTAINER:-tkoc_db}
backup_dir=${BACKUP_DIR:-"$config_dir/backups"}

restore_tty() {
  stty echo 2>/dev/null || true
}

cleanup() {
  restore_tty
  [ -z "${root_tmp:-}" ] || rm -f -- "$root_tmp"
  [ -z "${env_tmp:-}" ] || rm -f -- "$env_tmp"
  [ -z "${mysql_env_tmp:-}" ] || rm -f -- "$mysql_env_tmp"
  [ -z "${backup_tmp:-}" ] || rm -f -- "$backup_tmp"
}

trap cleanup EXIT
trap 'exit 130' HUP INT TERM

fail() {
  echo "Error: $*" >&2
  exit 1
}

random_password() {
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

read_password() {
  prompt=$1
  printf '%s (leave blank to generate 64 characters): ' "$prompt"
  stty -echo
  IFS= read -r entered_password
  stty echo
  printf '\n'

  if [ -z "$entered_password" ]; then
    entered_password=$(random_password)
    echo 'Generated a password; it will be stored in the protected configuration and not printed.'
  else
    printf 'Confirm password: '
    stty -echo
    IFS= read -r confirmed_password
    stty echo
    printf '\n'
    [ "$entered_password" = "$confirmed_password" ] || fail 'passwords did not match.'
  fi

  [ "${#entered_password}" -ge 32 ] || fail 'passwords must be at least 32 characters.'
  case "$entered_password" in
    *[!A-Za-z0-9._~-]*)
      fail 'use only URL-safe characters: A-Z, a-z, 0-9, dot, underscore, tilde, and hyphen.'
      ;;
  esac

  REPLY=$entered_password
  unset entered_password confirmed_password
}

command -v docker >/dev/null 2>&1 || fail 'Docker is not installed on this server.'
command -v gzip >/dev/null 2>&1 || fail 'gzip is not installed on this server.'
[ -f "$root_compose" ] || fail "root Compose file not found: $root_compose"
[ -f "$app_compose" ] || fail "TKOC Compose file not found: $app_compose"
docker container inspect "$database_container" >/dev/null 2>&1 || fail "container is not running: $database_container"

inline_root_count=$(grep -Ec '^[[:space:]]*MYSQL_ROOT_PASSWORD:[[:space:]]*' "$root_compose" || true)
inline_app_count=$(grep -Ec '^[[:space:]]*MYSQL_PASSWORD:[[:space:]]*' "$root_compose" || true)
persistent_env_count=$(grep -Ec '^[[:space:]]*-[[:space:]]*\./appdata/tkoc-modern/mysql\.env[[:space:]]*$' "$root_compose" || true)
if [ "$inline_root_count" -eq 1 ] && [ "$inline_app_count" -eq 1 ]; then
  migrate_root_compose=true
elif [ "$inline_root_count" -eq 0 ] && [ "$inline_app_count" -eq 0 ] && [ "$persistent_env_count" -eq 1 ]; then
  migrate_root_compose=false
else
  fail 'the tkoc-db credential configuration is not in a recognized state.'
fi

read_password 'New TKOC application database password'
app_password=$REPLY
read_password 'New MySQL root password'
root_password=$REPLY
[ "$app_password" != "$root_password" ] || fail 'the application and root passwords must be different.'

mkdir -p -- "$config_dir" "$backup_dir"
root_tmp=$(mktemp "${root_compose}.tmp.XXXXXX")
if [ "$migrate_root_compose" = true ]; then
  awk '
    /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { in_tkoc = ($0 ~ /^  tkoc-db:/) }
    in_tkoc && /^    environment:[[:space:]]*$/ {
      print "    env_file:"
      print "      - ./appdata/tkoc-modern/mysql.env"
      skipping_environment = 1
      replaced = 1
      next
    }
    skipping_environment && /^    [A-Za-z0-9_-]+:[[:space:]]*/ {
      skipping_environment = 0
    }
    skipping_environment { next }
    { print }
    END { if (replaced != 1) exit 42 }
  ' "$root_compose" > "$root_tmp" || fail 'could not migrate the tkoc-db Compose environment block.'
else
  cp -p -- "$root_compose" "$root_tmp"
fi

mysql_env_tmp=$(mktemp "${mysql_env}.tmp.XXXXXX")
cat > "$mysql_env_tmp" <<EOF
MYSQL_ROOT_PASSWORD=$root_password
MYSQL_DATABASE=tkoc
MYSQL_USER=tkoc
MYSQL_PASSWORD=$app_password
EOF

env_tmp=$(mktemp "${production_env}.tmp.XXXXXX")
if [ -f "$production_env" ]; then
  [ "$(grep -Ec '^DATABASE_URL=' "$production_env")" -eq 1 ] || fail 'expected exactly one DATABASE_URL entry in .env.production.'
  sed "s|^DATABASE_URL=.*$|DATABASE_URL=mysql://tkoc:$app_password@127.0.0.1:3306/tkoc|" "$production_env" > "$env_tmp"
else
  cat > "$env_tmp" <<EOF
DATABASE_URL=mysql://tkoc:$app_password@127.0.0.1:3306/tkoc
JWT_SECRET=$(random_password)
CRON_SECRET=$(random_password)
TICK_INTERVAL_SECONDS=3600
TICK_POLL_SECONDS=30
TICK_MAX_CATCH_UP=24
ENABLE_ADMIN_START_FRESH=true
PORT=3400
EOF
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
root_backup="$backup_dir/docker-compose.pre-password-rotation.${timestamp}.yml"
cp -p -- "$root_compose" "$root_backup"
if [ -f "$mysql_env" ]; then
  mysql_env_backup="${mysql_env}.pre-password-rotation.${timestamp}"
  cp -p -- "$mysql_env" "$mysql_env_backup"
fi
if [ -f "$production_env" ]; then
  env_backup="${production_env}.pre-password-rotation.${timestamp}"
  cp -p -- "$production_env" "$env_backup"
fi

backup_tmp=$(mktemp "$backup_dir/.tkoc-before-password-rotation.XXXXXX.sql")
database_backup="$backup_dir/tkoc-before-password-rotation-${timestamp}.sql.gz"
echo "Backing up MySQL to $database_backup ..."
docker exec "$database_container" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --triggers -uroot "$MYSQL_DATABASE"' > "$backup_tmp"
[ -s "$backup_tmp" ] || fail 'the database backup was empty; passwords were not changed.'
gzip -c "$backup_tmp" > "$database_backup"
chmod 600 "$database_backup"
rm -f -- "$backup_tmp"
backup_tmp=''

echo 'Updating the live MySQL accounts...'
printf "ALTER USER 'tkoc'@'%%' IDENTIFIED BY '%s';\nALTER USER 'root'@'localhost' IDENTIFIED BY '%s';\n" \
  "$app_password" "$root_password" |
  docker exec -i "$database_container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"'

mv -f -- "$root_tmp" "$root_compose"
root_tmp=''
mv -f -- "$mysql_env_tmp" "$mysql_env"
mysql_env_tmp=''
mv -f -- "$env_tmp" "$production_env"
env_tmp=''
chmod 600 "$root_compose" "$mysql_env" "$production_env" "$root_backup"
[ -z "${mysql_env_backup:-}" ] || chmod 600 "$mysql_env_backup"
[ -z "${env_backup:-}" ] || chmod 600 "$env_backup"

echo 'Recreating the database container with the updated protected environment...'
docker compose -f "$root_compose" up -d tkoc-db

attempt=0
until docker exec "$database_container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqladmin ping -uroot --silent' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || fail 'MySQL did not become ready within 60 seconds. Inspect the database logs.'
  sleep 2
done

result=$(docker exec -e TKOC_VERIFY_PASSWORD="$app_password" "$database_container" sh -c \
  'MYSQL_PWD="$TKOC_VERIFY_PASSWORD" exec mysql -utkoc "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT 1"')
[ "$result" = '1' ] || fail 'the new TKOC application login could not be verified.'

if docker container inspect tkoc-web >/dev/null 2>&1; then
  echo 'Restarting TKOC web and tick containers with the new application credential...'
  docker compose -f "$app_compose" up -d web tick
else
  echo 'TKOC is not deployed yet; its production environment is ready for the first deployment.'
fi

unset app_password root_password REPLY
echo 'MySQL root and TKOC application passwords were rotated and verified.'
echo "Pre-rotation database backup: $database_backup"
echo "Protected pre-rotation Compose backup: $root_backup"
[ -z "${mysql_env_backup:-}" ] || echo "Protected pre-rotation MySQL environment backup: $mysql_env_backup"
[ -z "${env_backup:-}" ] || echo "Protected pre-rotation environment backup: $env_backup"
