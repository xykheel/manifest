# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Schema must exist before pnpm install so apps/api postinstall (prisma generate) succeeds
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
RUN pnpm install

FROM deps AS dev
COPY turbo.json package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @manifest/shared build
RUN pnpm --filter @manifest/api exec prisma generate
EXPOSE 3001
CMD ["pnpm", "--filter", "@manifest/api", "dev"]

FROM deps AS builder
COPY turbo.json package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
RUN pnpm --filter @manifest/shared build
RUN pnpm --filter @manifest/api exec prisma generate
RUN pnpm --filter @manifest/api build

FROM builder AS pruned
WORKDIR /app
ENV NODE_ENV=production
RUN pnpm prune --prod

FROM node:20-alpine AS prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=pruned /app /app
COPY --from=builder /entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 3001
ENV NODE_ENV=production
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
