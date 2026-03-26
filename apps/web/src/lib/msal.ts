import { Configuration, LogLevel, PublicClientApplication } from "@azure/msal-browser";

export function createMsalInstance(tenantId: string, clientId: string): PublicClientApplication {
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
