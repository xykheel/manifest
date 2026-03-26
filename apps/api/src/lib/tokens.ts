import jwt from "jsonwebtoken";
import { AuthProvider, JwtAccessPayload, UserRole } from "@onboarding/shared";
import { env } from "./env";

export function signAccessToken(payload: Omit<JwtAccessPayload, "iat" | "exp">): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtAccessPayload;
  return {
    ...decoded,
    role: decoded.role as UserRole,
    authProvider: decoded.authProvider as AuthProvider,
  };
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}
