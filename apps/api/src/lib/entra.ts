import * as msal from "@azure/msal-node";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";

let jwksCache: { tenant: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function getJwks() {
  if (!env.ssoEnabled) throw new Error("SSO is not configured");
  if (!jwksCache || jwksCache.tenant !== env.entraTenantId) {
    const jwksUri = `https://login.microsoftonline.com/${env.entraTenantId}/discovery/v2.0/keys`;
    jwksCache = { tenant: env.entraTenantId, jwks: createRemoteJWKSet(new URL(jwksUri)) };
  }
  return jwksCache.jwks;
}

export async function verifyEntraIdToken(idToken: string): Promise<JWTPayload> {
  if (!env.ssoEnabled) throw new Error("SSO is not configured");
  const issuer = `https://login.microsoftonline.com/${env.entraTenantId}/v2.0`;
  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer,
    audience: env.entraClientId,
  });
  return payload;
}

export function createMsalConfidentialClient(): msal.ConfidentialClientApplication {
  if (!env.ssoEnabled) throw new Error("SSO is not configured");
  if (!env.entraClientSecret) {
    throw new Error("ENTRA_CLIENT_SECRET is required for authorization code exchange");
  }
  return new msal.ConfidentialClientApplication({
    auth: {
      clientId: env.entraClientId,
      authority: `https://login.microsoftonline.com/${env.entraTenantId}`,
      clientSecret: env.entraClientSecret,
    },
  });
}

export async function acquireTokenByAuthCode(code: string, redirectUri: string) {
  const client = createMsalConfidentialClient();
  const result = await client.acquireTokenByCode({
    code,
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri,
  });
  if (!result?.idToken) throw new Error("No ID token returned from Entra");
  return result;
}

function namesFromIdTokenClaims(payload: JWTPayload): {
  firstName: string | null;
  lastName: string | null;
} {
  const given = (payload.given_name as string | undefined)?.trim();
  const family = (payload.family_name as string | undefined)?.trim();
  if (given || family) {
    return {
      firstName: given && given.length > 0 ? given : null,
      lastName: family && family.length > 0 ? family : null,
    };
  }
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return { firstName: null, lastName: null };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") };
  }
  return { firstName: parts[0] ?? null, lastName: null };
}

export function fetchProfileFromIdTokenClaims(payload: JWTPayload): {
  oid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
} {
  const oid = (payload.oid ?? payload.sub) as string | undefined;
  if (!oid) throw new Error("Token missing oid/sub");

  const email =
    (payload.preferred_username as string | undefined) ||
    (payload.email as string | undefined) ||
    (payload.upn as string | undefined);
  if (!email) throw new Error("Token missing email claim");

  const { firstName, lastName } = namesFromIdTokenClaims(payload);
  return { oid, email: email.toLowerCase(), firstName, lastName };
}

/** @deprecated Use fetchProfileFromIdTokenClaims for name fields. */
export function fetchOidAndEmailFromIdTokenClaims(payload: JWTPayload): { oid: string; email: string } {
  const p = fetchProfileFromIdTokenClaims(payload);
  return { oid: p.oid, email: p.email };
}
