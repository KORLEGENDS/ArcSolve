FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

COPY apps/outbox-worker/package.json ./package.json
COPY apps/outbox-worker/tsconfig.json ./tsconfig.json
COPY apps/outbox-worker/worker.ts ./worker.ts
COPY tsconfig.json /tsconfig.json

RUN pnpm install --prod=false && pnpm exec tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
CMD ["node", "dist/worker.js"]


