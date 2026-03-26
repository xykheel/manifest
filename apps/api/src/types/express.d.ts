import type { JwtAccessPayload } from "@onboarding/shared";

declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
    }
  }
}

export {};
