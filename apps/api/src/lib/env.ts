import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

const tenantId = trimOrEmpty(process.env.ENTRA_TENANT_ID);
const clientId = trimOrEmpty(process.env.ENTRA_CLIENT_ID);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: trimOrEmpty(process.env.DATABASE_URL),
  jwtSecret: trimOrEmpty(process.env.JWT_SECRET),
  jwtRefreshSecret: trimOrEmpty(process.env.JWT_REFRESH_SECRET),
  jwtExpiresIn: trimOrEmpty(process.env.JWT_EXPIRES_IN) || "15m",
  jwtRefreshExpiresIn: trimOrEmpty(process.env.JWT_REFRESH_EXPIRES_IN) || "7d",
  apiHost: trimOrEmpty(process.env.API_HOST) || "0.0.0.0",
  apiPort: Number.parseInt(trimOrEmpty(process.env.API_PORT) || "3001", 10),
  webOrigin: trimOrEmpty(process.env.WEB_ORIGIN) || "http://localhost:5173",
  entraTenantId: tenantId,
  entraClientId: clientId,
  entraClientSecret: trimOrEmpty(process.env.ENTRA_CLIENT_SECRET),
  get ssoEnabled(): boolean {
    return Boolean(tenantId && clientId);
  },
};

export function assertEnv(): void {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
  if (!env.jwtSecret) throw new Error("JWT_SECRET is required");
  if (!env.jwtRefreshSecret) throw new Error("JWT_REFRESH_SECRET is required");
}
