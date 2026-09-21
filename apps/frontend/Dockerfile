# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

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

COPY tsconfig.json tsconfig.json
COPY tsconfig.base.json tsconfig.base.json

COPY packages/domain packages/domain
COPY packages/protocol packages/protocol
COPY apps/frontend apps/frontend

RUN npm run build --workspace=@orderflow/domain

RUN npm run build --workspace=@orderflow/protocol

RUN npm run build --workspace=@orderflow/frontend


FROM nginx:alpine AS runtime

COPY apps/frontend/nginx.conf \
  /etc/nginx/conf.d/default.conf

COPY --from=build \
  /app/apps/frontend/dist \
  /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=10s \
  --retries=3 \
  CMD wget --quiet --output-document=- \
    http://127.0.0.1/nginx-health \
    || exit 1