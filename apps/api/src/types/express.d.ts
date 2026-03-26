import type { JwtAccessPayload } from "@manifest/shared";

declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
    }
  }
}

export {};
