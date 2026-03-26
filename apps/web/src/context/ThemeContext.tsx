import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "manifest-theme";

function applyDom(scheme: ColorScheme) {
  document.documentElement.classList.toggle("dark", scheme === "dark");
}

type ThemeContextValue = {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialFromDocument(): ColorScheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(readInitialFromDocument);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      if (e.newValue === "dark" || e.newValue === "light") {
        setSchemeState(e.newValue);
        applyDom(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyDom(next);
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyDom(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ scheme, setScheme, toggleScheme }),
    [scheme, setScheme, toggleScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
