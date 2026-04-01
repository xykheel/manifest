/**
 * Entra / OIDC redirect parameters (authorization code flow, implicit fragments).
 * If these are present, we must forward to /auth/callback before any Navigate to /login or /dashboard,
 * or the code is lost and the user appears "logged out" instantly.
 */
export function hasOAuthRedirectParams(search: string, hash: string): boolean {
  const searchHas = /[?&](code|id_token|session_state|state)=/.test(search);
  const hashHas = Boolean(hash) && /[#&?](code|id_token|session_state|state)=/.test(hash);
  return searchHas || hashHas;
}
