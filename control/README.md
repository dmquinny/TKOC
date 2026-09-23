# TKOC control panel

A small service, separate from the game, for starting, stopping, restarting,
updating, and rolling back the game containers and for watching the host.
It signs administrators in with their normal game account (the `User` table,
bcrypt password, access level 1), so it works whenever the database is up,
even while the game itself is stopped or broken.

The page has three tabs, a light and a dark theme (it follows the device
until you pick one), and works on a phone, where it can be installed as an
app (see below).

- **Overview**: a one-line verdict on the game (operational, degraded,
  stopped, action in progress), a card per container (web, tick, database,
  the panel itself) with its state, CPU, and memory, the game's health
  endpoint and auto-heal state, and the game clock straight from the
  database: a live countdown to the next tick, age, season, living provinces,
  accounts, database size. The actions, the live streamed output of the
  running action, and a short action history are here too.
- **System**: host load and memory with a trend line for the last hour (the
  panel samples them every 30 seconds, so the line is there when you open the
  page), uptime, disk usage for the app, appdata, and root filesystems,
  per-container CPU, memory, network, and disk I/O, and Docker's own disk
  usage.
- **Logs**: the last 100 to 1000 lines of any container, with a text filter,
  a Follow switch that reloads every 5 seconds, line wrapping, copy, and
  download.

Polling pauses while the browser tab is in the background.

Actions run one at a time: Start, Stop, Restart (recreate), Update
(`scripts/update.sh`), Full update (`--full`), Roll back
(`scripts/rollback.sh`), and Prune Docker (dangling images). Everything
except Start and Update asks for confirmation and shows the command it will
run.

`page.html` is self-contained (no build step, fonts, or CDN scripts) so the
panel still loads when the host has no internet access.

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

## Installing on a phone

The panel can be added to a phone's home screen, where it opens full
screen like a native app and stays signed in between uses. On Android,
Chrome shows an Install button in the panel's top bar (and offers to
install from its own menu); on an iPhone or iPad, open the panel in
Safari, tap Share, then Add to Home Screen. Chrome only offers to install
sites it loads over HTTPS, so on Android use the panel's HTTPS address
behind the reverse proxy rather than `http://<host>:3401`; Safari installs
from either. If the panel cannot be reached, the installed app shows a
message with a retry button instead of a browser error; nothing else is
cached, so a rebuilt panel always loads fresh. The manifest, icons, and
service worker live in `public/`. The icons are the game's emblem on a dark
tile with a small power badge, built by `scripts/make-icons.mjs` in the
repository root together with the game's own icons; run that again if the
emblem changes.

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
| `CONTROL_SESSION_DAYS` | `30` | Days a session stays valid after its last use |

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
stay valid for 30 days after their last use (`CONTROL_SESSION_DAYS`), so an
administrator stays signed in between visits. Signing out revokes the
session, and the account is re-checked against the database once a minute,
so banning it, removing its admin access, or changing its password (the game
bumps `sessionVersion`) ends its panel sessions too. Sign-in is rate limited
to 10 attempts per 15 minutes per address and username; every action
requires the custom request header the page sends, which blocks cross-site
form posts.
