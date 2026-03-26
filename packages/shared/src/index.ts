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

export const REFRESH_COOKIE_NAME = "refresh_token";
