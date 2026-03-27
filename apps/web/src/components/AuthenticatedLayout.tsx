import { UserRole } from "@manifest/shared";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AccountMenu } from "./AccountMenu";
import { AdministrationMegaMenu } from "./AdministrationMegaMenu";
import { PageWaveFooter } from "./PageWaveFooter";
import { ThemeToggle } from "./ThemeToggle";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition sm:text-base ${
    isActive
      ? "bg-brand/12 text-brand shadow-sm ring-1 ring-brand/20 dark:bg-brand/18 dark:text-brand dark:ring-brand/35"
      : "text-slate-600 hover:bg-slate-100/90 hover:text-brand dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-brand"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-xl px-3 py-3 text-base font-medium transition ${
    isActive
      ? "bg-brand/15 text-brand"
      : "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
  }`;

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      {open ? (
        <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

export function AuthenticatedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) {
    return null;
  }

  const isAdmin = user.role === UserRole.ADMIN;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const closeIfDesktop = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", closeIfDesktop);
    return () => mq.removeEventListener("change", closeIfDesktop);
  }, []);

  return (
    <div className="flex min-h-dvh min-h-screen flex-col bg-transparent dark:bg-slate-950">
      <header className="sticky top-0 z-50 overflow-visible border-b border-slate-200/70 bg-white/80 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-slate-700/70 dark:bg-slate-950/80 dark:shadow-black/10 dark:supports-[backdrop-filter]:bg-slate-950/75">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-3.5">
          <div className="flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
              aria-expanded={mobileOpen}
              aria-controls="mobile-primary-nav"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
              <HamburgerIcon open={mobileOpen} />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <ThemeToggle />
              <AccountMenu />
            </div>
          </div>

          <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
            <nav
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2"
              aria-label="Primary"
            >
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/onboarding" className={navLinkClass}>
                Onboarding
              </NavLink>
              {isAdmin && (
                <div className="hidden lg:block">
                  <AdministrationMegaMenu />
                </div>
              )}
              {isAdmin && (
                <div className="flex items-center gap-x-5 lg:hidden">
                  <NavLink to="/admin/users" className={navLinkClass}>
                    Users
                  </NavLink>
                  <NavLink to="/admin/onboarding" className={navLinkClass}>
                    Builder
                  </NavLink>
                </div>
              )}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <AccountMenu />
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="animate-ui-fade-in fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id="mobile-primary-nav"
            className="animate-ui-fade-in fixed inset-y-0 left-0 z-[70] flex w-[min(100vw-2.5rem,18.5rem)] flex-col border-r border-slate-200/90 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Menu</span>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen(false)}
              >
                <span className="sr-only">Close</span>
                <HamburgerIcon open />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Primary mobile">
              <div className="flex flex-col gap-1">
                <NavLink
                  to="/dashboard"
                  className={mobileNavLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/onboarding"
                  className={mobileNavLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Onboarding
                </NavLink>
                {isAdmin && (
                  <>
                    <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Administration
                    </p>
                    <NavLink
                      to="/admin/users"
                      className={mobileNavLinkClass}
                      onClick={() => setMobileOpen(false)}
                    >
                      Users
                    </NavLink>
                    <NavLink
                      to="/admin/onboarding"
                      className={mobileNavLinkClass}
                      onClick={() => setMobileOpen(false)}
                    >
                      Builder
                    </NavLink>
                  </>
                )}
              </div>
            </nav>
          </div>
        </>
      )}

      <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-transparent dark:bg-slate-950">
        <div
          key={location.pathname}
          className="animate-ui-fade-in flex min-h-0 flex-1 flex-col"
        >
          <Outlet />
        </div>
      </div>
      <PageWaveFooter />
    </div>
  );
}
