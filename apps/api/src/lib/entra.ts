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

export async function fetchOidAndEmailFromIdTokenClaims(payload: JWTPayload): Promise<{
  oid: string;
  email: string;
}> {
  const oid = (payload.oid ?? payload.sub) as string | undefined;
  if (!oid) throw new Error("Token missing oid/sub");

  const email =
    (payload.preferred_username as string | undefined) ||
    (payload.email as string | undefined) ||
    (payload.upn as string | undefined);
  if (!email) throw new Error("Token missing email claim");

  return { oid, email: email.toLowerCase() };
}
