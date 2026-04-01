import { MsalProvider } from "@azure/msal-react";
import type { SsoConfigResponse } from "@manifest/shared";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/AdminRoute";
import { AuthenticatedLayout } from "./components/AuthenticatedLayout";
import { DefaultEntryRedirect } from "./components/DefaultEntryRedirect";
import { OAuthRedirectToCallback } from "./components/OAuthRedirectToCallback";
import { PrivateRoute } from "./components/PrivateRoute";
import { AuthProvider } from "./context/AuthContext";
import { SsoProvider } from "./context/SsoContext";
import { baseURL } from "./lib/api";
import { createMsalInstance } from "./lib/msal";
import { AuthCallbackPage } from "./pages/AuthCallback";
import { AdminAiSettingsPage } from "./pages/admin/AdminAiSettingsPage";
import { AdminAnalyticsPage } from "./pages/admin/AdminAnalyticsPage";
import { AdminOnboardingProgramsPage } from "./pages/admin/AdminOnboardingProgramsPage";
import { AdminProgramEditorPage } from "./pages/admin/AdminProgramEditorPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { OnboardingListPage } from "./pages/onboarding/OnboardingListPage";
import { OnboardingPlayerPage } from "./pages/onboarding/OnboardingPlayerPage";

function AppShell({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SsoConfigResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await axios.get<SsoConfigResponse>(`${baseURL}/api/auth/sso/config`, {
          withCredentials: true,
        });
        setConfig(data);
      } catch {
        setConfig({ ssoEnabled: false });
      }
    })();
  }, []);

  const instance = useMemo(() => {
    if (!config?.ssoEnabled || !config.tenantId || !config.clientId) {
      return null;
    }
    return createMsalInstance(config.tenantId, config.clientId);
  }, [config]);

  if (!config) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  const ssoEnabled = Boolean(config.ssoEnabled && instance);

  const inner = (
    <SsoProvider value={{ ssoEnabled, ready: true }}>
      <AuthProvider>{children}</AuthProvider>
    </SsoProvider>
  );

  if (ssoEnabled && instance) {
    return <MsalProvider instance={instance}>{inner}</MsalProvider>;
  }

  return (
    <SsoProvider value={{ ssoEnabled: false, ready: true }}>
      <AuthProvider>{children}</AuthProvider>
    </SsoProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <OAuthRedirectToCallback />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<PrivateRoute />}>
            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/onboarding" element={<OnboardingListPage />} />
              <Route path="/onboarding/:programId" element={<OnboardingPlayerPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                <Route path="/admin/onboarding" element={<AdminOnboardingProgramsPage />} />
                <Route path="/admin/onboarding/:programId" element={<AdminProgramEditorPage />} />
                <Route path="/admin/settings" element={<AdminAiSettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="/" element={<DefaultEntryRedirect />} />
          <Route path="*" element={<DefaultEntryRedirect />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
