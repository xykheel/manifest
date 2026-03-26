import type { JwtAccessPayload } from "@onboarding/shared";

export function decodeAccessToken(token: string): JwtAccessPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const payload = parts[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json = atob(padded);
  return JSON.parse(json) as JwtAccessPayload;
}
