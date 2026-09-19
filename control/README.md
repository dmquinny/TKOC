# TKOC control panel

A small service, separate from the game, for starting, stopping, restarting,
updating, and rolling back the game containers and for watching the host.
It signs administrators in with their normal game account (the `User` table,
bcrypt password, access level 1), so it works whenever the database is up,
even while the game itself is stopped or broken.

What it shows:

- container states for web, tick, database, and the panel itself, plus the
  game's health endpoint;
- the game clock straight from the database: age, tick, season, next tick,
  living provinces, accounts, database size;
- host load, CPUs, memory, uptime, and disk usage for the app, appdata, and
  root filesystems;
- per-container CPU, memory, network, and disk I/O and Docker's own disk
  usage;
- live streamed output of the running action, a short action history, and a
  log viewer for each container.

Actions run one at a time: Start, Stop, Restart (recreate), Update
(`scripts/update.sh`), Full update (`--full`), Roll back
(`scripts/rollback.sh`), and Prune Docker (dangling images).

## Running it

The panel is defined as `tkoc-control` in the server's root compose file
(`/mnt/Apps/Apps/docker-compose.yml`, `W:\docker-compose.yml` on Windows),
next to the `tkoc-db` database it depends on. From that directory:

```sh
docker compose up -d --build tkoc-control
```

or from the app directory, `npm run control:up`. Then open
`http://<host>:3401`. Because it lives in the root compose project rather
than the game's own, the game's update never rebuilds or restarts it, and
stopping the game never stops the panel. Rebuild it the same way after
changing anything under `control/`. On startup the panel waits until MySQL is
ready before it starts listening, so it cannot come up with a broken database
connection after a reboot.

The container mounts the Docker socket, the app directory, and the appdata
directory at the same absolute paths the host uses, so the game's compose
file and scripts work unchanged from inside it. If your paths differ from
`/mnt/Apps/Apps/tkoc-modern` and `/mnt/Apps/Apps/appdata/tkoc-modern`, change
the `build.context`, `volumes`, `working_dir`, and `TKOC_*` values in that
service to match.

It can also run directly with Node 20+ on the host without Docker for the
panel itself (Docker is still needed to manage the game):

```sh
cd control && npm ci --omit=dev
TKOC_APP_DIR=/mnt/Apps/Apps/tkoc-modern node server.mjs
```

## Configuration

The panel reads `../appdata/tkoc-modern/.env.production` (or the file named
by `TKOC_ENV_FILE`) for `DATABASE_URL` and `JWT_SECRET`, so no new secrets
are required. Optional variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PORT` | `3401` | Listening port |
| `CONTROL_BIND` | `0.0.0.0` | Listening address |
| `CONTROL_SESSION_SECRET` | `JWT_SECRET` | Signs the panel's own session cookie |
| `TKOC_APP_DIR` | parent of `control/` | Folder with the compose file and scripts |
| `TKOC_HEALTH_URL` | `http://127.0.0.1:3400/api/health` | Game health check |
| `TKOC_DB_CONTAINER` | `tkoc_db` | Database container name for logs and stats |
| `CONTROL_AUTOHEAL` | on | `0` disables restarting an unhealthy game |

## Auto-heal

Docker marks the game unhealthy when its health check fails but never restarts
it. The panel checks once a minute, and if `tkoc-web` is running but Docker
reports it unhealthy twice in a row, it runs the Restart action as the user
`auto-heal`, so it shows up in the action history. It leaves a stopped game
alone, never interrupts another action such as an update, and waits at least
15 minutes between automatic restarts.

## Security notes

The panel has Docker socket access, which is equivalent to root on the host.
Keep it on the LAN or behind the same HTTPS reverse proxy as the game with
access restricted to you. Sessions are HTTP-only, same-site cookies that
expire after 12 hours; sign-in is rate limited to 10 attempts per 15 minutes
per address and username; every action requires the custom request header
the page sends, which blocks cross-site form posts.
