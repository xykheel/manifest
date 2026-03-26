import { REFRESH_COOKIE_NAME, UserRole } from "@manifest/shared";
import { AuthProvider, Prisma, UserRole as DbUserRole } from "@prisma/client";
import { compare } from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import {
  acquireTokenByAuthCode,
  fetchOidAndEmailFromIdTokenClaims,
  verifyEntraIdToken,
} from "../lib/entra";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const msFromExpiresIn = (expr: string): number => {
  const m = /^(\d+)([smhd])$/i.exec(expr.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number.parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mult =
    u === "s" ? 1000 : u === "m" ? 60_000 : u === "h" ? 3_600_000 : u === "d" ? 86_400_000 : 1000;
  return n * mult;
};

function setRefreshCookie(res: import("express").Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: msFromExpiresIn(env.jwtRefreshExpiresIn),
  });
}

function clearRefreshCookie(res: import("express").Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
    authProvider: user.authProvider as import("@manifest/shared").AuthProvider,
  });
  const refreshToken = signRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }
  try {
    const { sub } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) {
      clearRefreshCookie(res);
      res.status(401).json({ error: "User not found" });
      return;
    }
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      authProvider: user.authProvider as import("@manifest/shared").AuthProvider,
    });
    res.json({ accessToken });
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).send();
});

router.get("/sso/config", (_req, res) => {
  if (!env.ssoEnabled) {
    res.json({ ssoEnabled: false });
    return;
  }
  res.json({
    ssoEnabled: true,
    tenantId: env.entraTenantId,
    clientId: env.entraClientId,
  });
});

const ssoCallbackSchema = z
  .object({
    idToken: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    redirectUri: z.string().url().optional(),
  })
  .refine(
    (b) => Boolean(b.idToken) || Boolean(b.code && b.redirectUri),
    "Provide idToken (SPA) or code and redirectUri (confidential app)",
  );

router.post("/sso/callback", async (req, res) => {
  if (!env.ssoEnabled) {
    res.status(400).json({ error: "SSO is not enabled" });
    return;
  }
  const parsed = ssoCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().formErrors.join(", ") });
    return;
  }
  let idToken: string;
  try {
    if (parsed.data.idToken) {
      idToken = parsed.data.idToken;
    } else if (parsed.data.code && parsed.data.redirectUri) {
      const result = await acquireTokenByAuthCode(parsed.data.code, parsed.data.redirectUri);
      idToken = result.idToken;
    } else {
      res.status(400).json({ error: "Invalid SSO payload" });
      return;
    }

    const payload = await verifyEntraIdToken(idToken);
    const { oid, email } = await fetchOidAndEmailFromIdTokenClaims(payload);

    let user = await prisma.user.findUnique({ where: { entraId: oid } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            entraId: oid,
            authProvider: AuthProvider.ENTRA_ID,
            passwordHash: null,
          },
        });
      } else {
        try {
          user = await prisma.user.create({
            data: {
              email,
              entraId: oid,
              authProvider: AuthProvider.ENTRA_ID,
              passwordHash: null,
              role: DbUserRole.USER,
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            res.status(409).json({ error: "Account could not be linked. Email may be in use." });
            return;
          }
          throw e;
        }
      }
    } else if (user.email !== email) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email },
      });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      authProvider: user.authProvider as import("@manifest/shared").AuthProvider,
    });
    const refreshToken = signRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SSO validation failed";
    res.status(401).json({ error: message });
  }
});

export { router as authRouter };
