import {
  Configuration,
  LogLevel,
  type IPublicClientApplication,
  PublicClientApplication,
} from "@azure/msal-browser";

/**
 * MSAL throws if you call getAllAccounts, acquireTokenSilent, loginRedirect, etc. before this resolves.
 * MsalProvider runs initialize() in an effect; user actions or AuthCallback can run in the same tick — always await this first.
 */
export async function ensureMsalInitialized(instance: IPublicClientApplication): Promise<void> {
  await instance.initialize();
}

/**
 * Clears MSAL token/account cache and sessionStorage keys (fixes stuck "Pick an account" / too many retries).
 * Call after ensureMsalInitialized. User should try "Sign in with Microsoft" again after this.
 */
export async function clearMsalBrowserState(instance: IPublicClientApplication): Promise<void> {
  await instance.initialize();
  await instance.clearCache();
  for (const k of Object.keys(sessionStorage)) {
    if (k.startsWith("msal.")) {
      sessionStorage.removeItem(k);
    }
  }
}

export function createMsalInstance(tenantId: string, clientId: string): PublicClientApplication {
  /** Must match Entra app “Redirect URI” exactly (SPA), or handleRedirectPromise never completes and no backend SSO/cookie. */
  const config: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: `${window.location.origin}/auth/callback`,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
      },
    },
  };
  return new PublicClientApplication(config);
}

export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
};
