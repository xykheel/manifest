export const UserRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AuthProvider = {
  LOCAL: "LOCAL",
  ENTRA_ID: "ENTRA_ID",
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export interface JwtAccessPayload {
  sub: string;
  email: string;
  /** Display names from profile (optional for legacy tokens). */
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  iat?: number;
  exp?: number;
}

export interface SsoConfigResponse {
  ssoEnabled: boolean;
  tenantId?: string;
  clientId?: string;
}

/** GET /api/auth/session — whether an httpOnly refresh cookie is present (no JWT verification). */
export interface AuthSessionResponse {
  hasRefreshCookie: boolean;
}

export const REFRESH_COOKIE_NAME = "refresh_token";

/** Full account payload from GET /api/me (JWT fields plus server data). */
export type MeUser = JwtAccessPayload & {
  departments: import("./departments").Department[];
};

export * from "./departments";
