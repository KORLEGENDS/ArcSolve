FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# 패키지/설정/소스
COPY apps/uws-gateway/package.json ./package.json
COPY apps/main/tsconfig.json ./tsconfig.base.json
COPY apps/uws-gateway/tsconfig.json ./tsconfig.json
COPY apps/uws-gateway/server.ts ./server.ts
COPY apps/uws-gateway/server-utils.ts ./server-utils.ts

# tsconfig.json의 extends 경로 수정 (Docker 빌드 컨텍스트에 맞게)
RUN sed -i 's|"extends": "../main/tsconfig.json"|"extends": "./tsconfig.base.json"|' tsconfig.json

# devDeps 설치 후 컴파일
RUN pnpm install --prod=false && pnpm exec tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
ENV PORT=8080
EXPOSE 8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
CMD ["node", "dist/server.js"]


