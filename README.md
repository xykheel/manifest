# Manifest monorepo

Full-stack TypeScript monorepo for **Manifest**: **React 18** (Vite, Tailwind CSS, React Router v6), **Express** API, **PostgreSQL** with **Prisma**, and **JWT** authentication (access token in memory on the client, refresh token in an httpOnly cookie). Optional **Microsoft Entra ID (Azure AD)** sign-in is driven entirely by environment variables (`ENTRA_TENANT_ID` and `ENTRA_CLIENT_ID` must both be set to enable SSO).

## Layout

- `apps/web` — Vite + React frontend  
- `apps/api` — Express API and Prisma schema  
- `packages/shared` — Shared enums, types, and constants  

## Prerequisites

- Node.js 20+  
- pnpm 9 (`corepack enable` / `corepack prepare pnpm@9.15.4 --activate`)  
- Docker Desktop (or compatible engine) for the container workflow  

## Local setup (without Docker)

1. Copy environment templates:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

2. For API and web, point `DATABASE_URL` at your PostgreSQL instance. When running the API on the host (not in Docker), use `localhost` as the database host. The root `.env.example` uses host `postgres` for Compose on the Docker network.

3. Install dependencies and generate the Prisma client:

   ```bash
   pnpm install
   pnpm --filter @manifest/shared build
   cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma db seed
   ```

4. Run in separate terminals:

   ```bash
   pnpm --filter @manifest/api dev
   pnpm --filter @manifest/web dev
   ```

5. Open `http://localhost:5173`. Seeded accounts (after `db seed`): `admin@example.com` / `Admin123!` (ADMIN) and `user@example.com` / `User123!` (USER).

## Docker (development)

**Prerequisites:** Docker with Compose support. Copy `.env.example` to `.env` at the repository root and adjust secrets.

Start the stack (PostgreSQL, API on port **3001**, Vite on **5173**):

```bash
docker compose up --build
```

Detached mode:

```bash
docker compose up --build -d
```

- The API container runs `prisma migrate deploy` on startup, then starts the dev server with hot reload.  
- Source is bind-mounted into `api` and `web`; on each start the containers run `pnpm install` (and shared build / `prisma generate` for the API) so `node_modules` stays usable with the anonymous volume pattern.  
- After changing dependencies, rebuild or restart the services so installs run again.  

### Migrations inside the running API container

Create a new migration (developer convenience):

```bash
make db-migrate NAME=describe_change
```

or:

```bash
NAME=describe_change pnpm db:migrate
```

Seed the database:

```bash
make db-seed
# or
pnpm db:seed
```

### Connect to Postgres from a desktop client

- Host: `localhost`  
- Port: `5432`  
- Database / user / password: match `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` in `.env`.

## Docker (production)

Production uses a **standalone** Compose file so development bind mounts are not applied (`docker-compose.yml` is intentionally dev-focused).

```bash
docker compose -f docker-compose.prod.yml --env-file .env up --build
```

- Web is served by nginx on host port **8080** (container port 80).  
- API remains on **3001**.  
- Set `WEB_ORIGIN` to the public origin of the web app (for example `http://localhost:8080`) so CORS allows the browser.  
- Set `VITE_API_URL` at **build time** (build arg / `.env` for Compose) to the URL browsers use to reach the API (for example `http://localhost:3001`).  

> **Note:** Combining `docker-compose.yml` with `docker-compose.prod.yml` is not supported for a clean production image because Compose merges volume lists; use `docker-compose.prod.yml` alone for production.

## Enable Microsoft Entra ID SSO

SSO is **off** when either `ENTRA_TENANT_ID` or `ENTRA_CLIENT_ID` is empty. When **both** are set, the API exposes SSO config and the login page shows **Sign in with Microsoft** plus the email/password path.

1. Register an application in Microsoft Entra ID.  
2. Under **Authentication**, add a **Single-page application** redirect URI: `http://localhost:5173/auth/callback` (and your production URL when you deploy).  
3. Enable ID tokens; the frontend sends the **ID token** to `POST /api/auth/sso/callback`.  
4. Set in `.env` / `apps/api/.env`:

   - `ENTRA_TENANT_ID` — directory (tenant) ID  
   - `ENTRA_CLIENT_ID` — application (client) ID  
   - `ENTRA_CLIENT_SECRET` — optional; required only if you use the confidential **authorisation code** exchange (`code` + `redirectUri` body) instead of the default SPA **ID token** flow.  

5. Ensure the API `WEB_ORIGIN` (or CORS origin) matches the SPA origin.

## API routes (summary)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Email/password; sets refresh cookie; returns `{ accessToken }`. |
| POST | `/api/auth/refresh` | Uses refresh cookie; returns `{ accessToken }`. |
| POST | `/api/auth/logout` | Clears refresh cookie. |
| GET | `/api/auth/sso/config` | `{ ssoEnabled, tenantId?, clientId? }`. |
| POST | `/api/auth/sso/callback` | Body: `{ idToken }` (SPA) or `{ code, redirectUri }` (confidential app with secret). |

Protected examples: `GET /api/me` (Bearer access token), `GET /api/admin/ping` (ADMIN only).

## Scripts (root)

- `pnpm dev` — Turborepo dev across packages (local Node install).  
- `pnpm build` — Build via Turborepo.  
- `pnpm db:migrate` — Run `prisma migrate dev` inside the **api** Compose service (`NAME` required).  
- `pnpm db:seed` — Run Prisma seed inside the **api** Compose service.  

## pnpm lockfile

If you rely on reproducible installs, run `pnpm install` on your machine to generate `pnpm-lock.yaml`, commit it, and you can switch Docker `RUN pnpm install` back to `pnpm install --frozen-lockfile` if you prefer stricter CI builds.
