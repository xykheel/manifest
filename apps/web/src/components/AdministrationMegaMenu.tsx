import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const LG_MQ = "(min-width: 1024px)";

function usePrefersHoverMenus() {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_MQ);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return matches;
}

const menuTileClass = (isActive: boolean) =>
  [
    "group/menu block rounded-2xl border p-3 transition duration-200 sm:p-4",
    isActive
      ? "border-brand/30 bg-brand-light/90 shadow-sm ring-1 ring-brand/20 dark:border-brand/40 dark:bg-slate-800 dark:ring-brand/30"
      : "border-slate-200 bg-white hover:border-brand/25 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand/35 dark:hover:bg-slate-700/80",
  ].join(" ");

export function AdministrationMegaMenu() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const hoverMenus = usePrefersHoverMenus();

  const adminActive = location.pathname.startsWith("/admin");

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

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const openMenu = () => {
    cancelClose();
    setOpen(true);
  };

  const onTriggerClick = () => {
    setOpen((o) => !o);
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[100]"
      onMouseEnter={() => {
        if (hoverMenus) openMenu();
      }}
      onMouseLeave={() => {
        if (hoverMenus) scheduleClose();
      }}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition sm:text-base ${
          adminActive
            ? "bg-brand/12 text-brand shadow-sm ring-1 ring-brand/20 dark:bg-brand/18 dark:ring-brand/35"
            : "text-slate-600 hover:bg-slate-100/90 hover:text-brand dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-brand"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onTriggerClick}
      >
        Administration
        <svg
          className={`h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="animate-ui-fade-in absolute left-0 top-full z-[110] pt-2 motion-reduce:transition-none"
          role="menu"
          aria-label="Administration"
        >
          <div className="relative w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-megamenu ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10 sm:w-[28rem] sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/12 to-transparent dark:from-brand/25 dark:to-transparent" />
            <p className="relative border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:text-slate-400">
              Administration
            </p>
            <ul className="relative mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
              <li>
                <NavLink
                  to="/admin/users"
                  role="menuitem"
                  className={({ isActive }) => menuTileClass(isActive)}
                >
                  <span className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                    Users
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-slate-600 dark:text-slate-300">
                    Accounts, roles, and access.
                  </span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/onboarding"
                  role="menuitem"
                  className={({ isActive }) => menuTileClass(isActive)}
                >
                  <span className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                    Builder
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-slate-600 dark:text-slate-300">
                    Programmes, steps, and quizzes.
                  </span>
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
