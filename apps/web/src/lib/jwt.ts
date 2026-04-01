import type { JwtAccessPayload } from "@manifest/shared";

export function decodeAccessToken(token: string): JwtAccessPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const payload = parts[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json = atob(padded);
  return JSON.parse(json) as JwtAccessPayload;
}

/** Small skew so we do not treat a token as expired right at the boundary. */
const CLOCK_SKEW_SEC = 30;

/** True if the JWT decodes and is not past `exp` (if present). */
export function isAccessTokenValid(token: string): boolean {
  try {
    const payload = decodeAccessToken(token);
    if (payload.exp == null) return true;
    return payload.exp + CLOCK_SKEW_SEC > Date.now() / 1000;
  } catch {
    return false;
  }
}
