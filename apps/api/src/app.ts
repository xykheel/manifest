import { UserRole } from "@manifest/shared";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { authenticate } from "./middleware/authenticate";
import { requireRole } from "./middleware/requireRole";
import { adminOnboardingRouter } from "./routes/admin/onboarding";
import { adminUsersRouter } from "./routes/admin/users";
import { authRouter } from "./routes/auth";
import { onboardingRouter } from "./routes/onboarding";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: env.webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);

  app.get("/api/me", authenticate, (req, res) => {
    res.json({ user: req.user });
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
  app.use("/api/admin", authenticate, requireRole(UserRole.ADMIN), adminUsersRouter);
  app.use("/api/onboarding", authenticate, onboardingRouter);

  return app;
}
