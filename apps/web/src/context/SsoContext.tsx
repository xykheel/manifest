import { createContext, useContext } from "react";

export type SsoState = {
  ssoEnabled: boolean;
  ready: boolean;
};

const SsoContext = createContext<SsoState | null>(null);

export function SsoProvider({
  value,
  children,
}: {
  value: SsoState;
  children: React.ReactNode;
}) {
  return <SsoContext.Provider value={value}>{children}</SsoContext.Provider>;
}

export function useSso(): SsoState {
  const ctx = useContext(SsoContext);
  if (!ctx) throw new Error("useSso must be used within SsoProvider");
  return ctx;
}
