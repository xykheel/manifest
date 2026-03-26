import { UserRole } from "@onboarding/shared";
import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500">Role</dt>
              <dd className="font-medium text-slate-900">{user.role}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500">Auth</dt>
              <dd className="font-medium text-slate-900">{user.authProvider}</dd>
            </div>
          </dl>
        </section>

        {isAdmin && (
          <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6">
            <h2 className="text-base font-semibold text-indigo-950">Admin panel</h2>
            <p className="mt-2 text-sm text-indigo-900/90">
              You have administrator access. Extend this section with onboarding administration tools.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
