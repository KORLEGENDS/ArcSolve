FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# 패키지/설정/소스
COPY apps/uws-gateway/package.json ./package.json
COPY apps/uws-gateway/tsconfig.json ./tsconfig.json
COPY apps/uws-gateway/server.ts ./server.ts
COPY tsconfig.json /tsconfig.json

# devDeps 설치 후 컴파일
RUN pnpm install --prod=false && pnpm exec tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
ENV PORT=8080
EXPOSE 8080
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]


