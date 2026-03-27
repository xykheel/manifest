import { DEPARTMENT_LABELS, UserRole } from "@manifest/shared";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <div className="min-h-0 flex-1 bg-transparent dark:bg-slate-950">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <h1 className="text-md-headline font-medium tracking-tight text-slate-800 dark:text-slate-100 md:text-[2.125rem] md:leading-[2.75rem]">
          Dashboard
        </h1>
        <p className="-mt-1 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Use the bar above to open{" "}
          <Link to="/onboarding" className="link-brand">
            onboarding
          </Link>
          {isAdmin && (
            <>
              {", "}
              <Link to="/admin/users" className="link-brand">
                user management
              </Link>
              {", or the "}
              <Link to="/admin/onboarding" className="link-brand">
                onboarding builder
              </Link>
            </>
          )}
          .
        </p>

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Account
          </h2>
          <dl className="mt-4 space-y-3 text-base">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.role}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Auth</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.authProvider}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Departments</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">
                {user.departments.length === 0 ? (
                  <span className="font-normal text-slate-500 dark:text-slate-400">None assigned</span>
                ) : (
                  user.departments.map((d) => DEPARTMENT_LABELS[d]).join(", ")
                )}
              </dd>
            </div>
          </dl>
        </section>

        {isAdmin && (
          <section className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/80 to-brand-soft/40 p-6 sm:p-8 dark:border-brand/40 dark:bg-slate-900 dark:[background-image:none]">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Admin</h2>
            <p className="mt-2 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Build onboarding paths, lessons, and quizzes for your users.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/admin/users"
                className="btn-primary flex w-full items-center justify-center sm:inline-flex sm:w-auto"
              >
                Manage users
              </Link>
              <Link
                to="/admin/onboarding"
                className="btn-secondary flex w-full items-center justify-center py-3 sm:inline-flex sm:w-auto sm:py-2"
              >
                Onboarding builder
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
