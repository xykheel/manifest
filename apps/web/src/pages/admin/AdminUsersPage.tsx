import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

type AuthProvider = "LOCAL" | "ENTRA_ID";

type AdminUserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
  authProvider: AuthProvider;
  entraId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);

  const [roleDraft, setRoleDraft] = useState<Record<string, "ADMIN" | "USER">>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ users: AdminUserRow[] }>("/api/admin/users");
      setUsers(data.users);
      const drafts: Record<string, "ADMIN" | "USER"> = {};
      for (const u of data.users) drafts[u.id] = u.role;
      setRoleDraft(drafts);
    } catch {
      setError("Could not load users.");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || newPassword.length < 8) {
      setError("Email and a password of at least 8 characters are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await api.post("/api/admin/users", {
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      });
      setNewEmail("");
      setNewPassword("");
      setNewRole("USER");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  async function saveRole(userId: string) {
    const next = roleDraft[userId];
    if (!next) return;
    const current = users?.find((u) => u.id === userId)?.role;
    if (current === next) return;
    setSavingId(userId);
    setError(null);
    try {
      await api.patch(`/api/admin/users/${userId}`, { role: next });
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not update role.");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  function signInLabel(p: AuthProvider): string {
    return p === "LOCAL" ? "Email & password" : "Microsoft Entra ID";
  }

  if (users === null) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <Link
            to="/dashboard"
            className="text-sm text-slate-600 transition hover:text-brand dark:text-slate-300"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Users
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Invite database accounts with email and password, and review everyone stored in Manifest
            (including people who signed in with Microsoft after SSO is wired).
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Add database user</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Creates a local account with email and password (minimum 8 characters).
          </p>
          <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={createUser}>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="input-field mt-1"
                autoComplete="off"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field mt-1"
                autoComplete="new-password"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "USER" | "ADMIN")}
                className="input-field mt-1"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            <button type="submit" disabled={creating} className="btn-primary w-full sm:w-auto">
              {creating ? "Adding…" : "Add user"}
            </button>
          </form>
        </section>

        <section className="card-surface overflow-hidden">
          <div className="border-b border-slate-200/80 px-6 py-4 dark:border-slate-700/80">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              All users ({users.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Sign-in</th>
                  <th className="px-6 py-3">Entra object ID</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-brand-soft/30 dark:border-slate-800 dark:hover:bg-brand/10"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{u.email}</span>
                      {me?.sub === u.id && (
                        <span className="ml-2 text-xs font-medium text-brand">(you)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {signInLabel(u.authProvider)}
                    </td>
                    <td className="px-6 py-4">
                      {u.entraId ? (
                        <code
                          className="block max-w-[12rem] truncate text-xs text-slate-600 dark:text-slate-400"
                          title={u.entraId}
                        >
                          {u.entraId}
                        </code>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={roleDraft[u.id] ?? u.role}
                        onChange={(e) =>
                          setRoleDraft((d) => ({
                            ...d,
                            [u.id]: e.target.value as "ADMIN" | "USER",
                          }))
                        }
                        className="input-field max-w-[11rem] py-1.5 text-xs"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={
                          savingId === u.id || (roleDraft[u.id] ?? u.role) === u.role
                        }
                        onClick={() => void saveRole(u.id)}
                        className="btn-primary-sm disabled:opacity-40"
                      >
                        {savingId === u.id ? "Saving…" : "Save role"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No users yet.</p>
          )}
        </section>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <Link to="/admin/onboarding" className="link-brand">
            ← Onboarding programs
          </Link>
        </p>
      </main>
    </div>
  );
}
