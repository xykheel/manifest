import { UserRole } from "@manifest/shared";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { authenticate } from "./middleware/authenticate";
import { requireRole } from "./middleware/requireRole";
import { adminAiSettingsRouter } from "./routes/admin/aiSettings";
import { adminAnalyticsRouter } from "./routes/admin/analytics";
import { adminOnboardingRouter } from "./routes/admin/onboarding";
import { adminUsersRouter } from "./routes/admin/users";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { onboardingRouter } from "./routes/onboarding";

const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function createApp() {
  const app = express();
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (origin === env.webOrigin) {
          callback(null, true);
          return;
        }
        if (env.nodeEnv !== "production" && localDevOrigin.test(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);

  app.get("/api/me", authenticate, async (req, res) => {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        authProvider: true,
        departments: { select: { department: true } },
      },
    });
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        sub: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        authProvider: dbUser.authProvider,
        departments: dbUser.departments.map((d) => d.department),
      },
    });
  });

  app.get("/api/admin/ping", authenticate, requireRole(UserRole.ADMIN), (_req, res) => {
    res.json({ ok: true, message: "admin" });
  });

  app.use(
    "/api/admin/onboarding",
    authenticate,
    requireRole(UserRole.ADMIN),
    adminOnboardingRouter,
  );
  app.use("/api/admin", authenticate, requireRole(UserRole.ADMIN), adminAnalyticsRouter);
  app.use("/api/admin", authenticate, requireRole(UserRole.ADMIN), adminUsersRouter);
  app.use("/api/admin", authenticate, requireRole(UserRole.ADMIN), adminAiSettingsRouter);
  app.use("/api/onboarding", authenticate, onboardingRouter);
  app.use("/api/chat", authenticate, chatRouter);

  return app;
}
