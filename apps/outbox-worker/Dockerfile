FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

COPY apps/outbox-worker/package.json ./package.json
COPY apps/main/tsconfig.json ./tsconfig.base.json
COPY apps/outbox-worker/tsconfig.json ./tsconfig.json
COPY apps/outbox-worker/worker.ts ./worker.ts
COPY apps/outbox-worker/worker-utils.ts ./worker-utils.ts
COPY apps/outbox-worker/worker-arcyou-chat.ts ./worker-arcyou-chat.ts
COPY apps/outbox-worker/worker-document.ts ./worker-document.ts

# tsconfig.json의 extends 경로 수정 (Docker 빌드 컨텍스트에 맞게)
RUN sed -i 's|"extends": "../main/tsconfig.json"|"extends": "./tsconfig.base.json"|' tsconfig.json

RUN pnpm install --prod=false && pnpm exec tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
CMD ["node", "dist/worker.js"]


