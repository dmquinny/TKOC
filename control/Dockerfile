# Standalone control panel. Built from the repository root so the compose
# file can reference it: docker compose --profile control up -d --build control
#
# The official docker CLI image already bundles the compose and buildx
# plugins; Node is added on top so the panel can drive the game's scripts.
FROM docker:27-cli

RUN apk add --no-cache nodejs npm curl gzip tzdata

WORKDIR /control
ENV NODE_ENV=production
COPY control/package.json control/package-lock.json ./
RUN npm ci --omit=dev
COPY control/server.mjs control/page.html ./
COPY control/public ./public

EXPOSE 3401
# The docker CLI image's entrypoint rewrites any command that matches a docker
# subcommand, and "node" is one (docker node ...). Bypass it and run Node
# directly by absolute path.
ENTRYPOINT ["/usr/bin/node"]
# Absolute path: compose sets working_dir to the game folder so that
# docker compose and the update scripts run from there.
CMD ["/control/server.mjs"]
