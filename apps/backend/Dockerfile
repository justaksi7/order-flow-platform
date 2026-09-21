# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

# Zuerst nur die Package-Dateien kopieren.
# Dadurch kann Docker npm ci zwischenspeichern.
COPY package.json package-lock.json ./

COPY apps/backend/package.json \
  apps/backend/package.json

COPY apps/frontend/package.json \
  apps/frontend/package.json

COPY packages/domain/package.json \
  packages/domain/package.json

COPY packages/market-data/package.json \
  packages/market-data/package.json

COPY packages/markets/package.json \
  packages/markets/package.json

COPY packages/protocol/package.json \
  packages/protocol/package.json

RUN npm ci

# TypeScript-Konfiguration
COPY tsconfig.json tsconfig.json
COPY tsconfig.base.json tsconfig.base.json

# Nur die für das Backend benötigten Quellen
COPY apps/backend apps/backend
COPY packages packages

RUN npm run build

# Development-Abhängigkeiten wie TypeScript entfernen
RUN npm prune --omit=dev


FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Die vorhandene node-Gruppe und der node-Benutzer
# des offiziellen Images werden verwendet.
COPY --from=build \
  --chown=node:node \
  /app/package.json \
  /app/package-lock.json \
  ./

COPY --from=build \
  --chown=node:node \
  /app/node_modules \
  ./node_modules

COPY --from=build \
  --chown=node:node \
  /app/apps/backend/package.json \
  ./apps/backend/package.json

COPY --from=build \
  --chown=node:node \
  /app/apps/backend/dist \
  ./apps/backend/dist

COPY --from=build \
  --chown=node:node \
  /app/packages/domain/package.json \
  ./packages/domain/package.json

COPY --from=build \
  --chown=node:node \
  /app/packages/domain/dist \
  ./packages/domain/dist

COPY --from=build \
  --chown=node:node \
  /app/packages/market-data/package.json \
  ./packages/market-data/package.json

COPY --from=build \
  --chown=node:node \
  /app/packages/market-data/dist \
  ./packages/market-data/dist

COPY --from=build \
  --chown=node:node \
  /app/packages/markets/package.json \
  ./packages/markets/package.json

COPY --from=build \
  --chown=node:node \
  /app/packages/markets/dist \
  ./packages/markets/dist

COPY --from=build \
  --chown=node:node \
  /app/packages/protocol/package.json \
  ./packages/protocol/package.json

COPY --from=build \
  --chown=node:node \
  /app/packages/protocol/dist \
  ./packages/protocol/dist

USER node

EXPOSE 8080

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "apps/backend/dist/main.js"]