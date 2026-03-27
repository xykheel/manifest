#!/bin/sh
set -e
cd /app/apps/api
# Keep Prisma Client in sync with schema (bind mounts in dev, or image rebuild drift in prod).
pnpm exec prisma generate
pnpm exec prisma migrate deploy
cd /app
exec "$@"
