import { DEPARTMENT_LABELS } from "@manifest/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? "?";
  const cleaned = local.replace(/[^a-z0-9]+/gi, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  const single = parts[0] ?? local;
  return single.slice(0, 2).toUpperCase() || "?";
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;

  const initials = emailInitials(user.email);

  return (
    <div ref={containerRef} className="relative z-[100]">
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand shadow-sm ring-2 ring-white transition hover:bg-brand/22 dark:bg-brand/20 dark:text-brand-muted dark:ring-slate-800 dark:hover:bg-brand/28"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? "Close account menu" : "Open account menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>{initials}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-[110] pt-2 motion-reduce:transition-none"
          role="menu"
          aria-label="Account"
        >
          <div className="relative w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-megamenu ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10 sm:w-80 sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/12 to-transparent dark:from-brand/25 dark:to-transparent" />
            <p className="relative border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:text-slate-400">
              Account
            </p>

            <div className="relative mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-800/80">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </dt>
                  <dd className="mt-0.5 break-all font-medium text-slate-800 dark:text-slate-100">
                    {user.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role
                  </dt>
                  <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">{user.role}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Auth
                  </dt>
                  <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">
                    {user.authProvider}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Departments
                  </dt>
                  <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">
                    {user.departments.length === 0 ? (
                      <span className="font-normal text-slate-500 dark:text-slate-400">None assigned</span>
                    ) : (
                      user.departments.map((d) => DEPARTMENT_LABELS[d]).join(", ")
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
              <Link
                to="/onboarding"
                role="menuitem"
                className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-brand transition hover:border-brand/30 hover:bg-brand-light/60 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand/40 dark:hover:bg-slate-700/80"
                onClick={() => setOpen(false)}
              >
                Go to onboarding
                <span className="mt-0.5 block text-xs font-normal text-slate-600 dark:text-slate-300">
                  Open your learning programmes.
                </span>
              </Link>
              <button
                type="button"
                role="menuitem"
                className="btn-secondary mt-3 flex w-full items-center justify-center py-3 text-sm font-medium sm:py-2.5"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
