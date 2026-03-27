import { ALL_DEPARTMENTS, DEPARTMENT_LABELS, type Department } from "@manifest/shared";
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
  departments: Department[];
  createdAt: string;
  updatedAt: string;
};

function deptsEqual(a: Department[], b: Department[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
}

function departmentsSummaryLine(depts: Department[]): string {
  if (depts.length === 0) return "None assigned";
  const labels = depts.map((d) => DEPARTMENT_LABELS[d]);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [newDepartments, setNewDepartments] = useState<Department[]>([]);
  const [creating, setCreating] = useState(false);

  const [roleDraft, setRoleDraft] = useState<Record<string, "ADMIN" | "USER">>({});
  const [departmentDraft, setDepartmentDraft] = useState<Record<string, Department[]>>({});

  const [deptModalUserId, setDeptModalUserId] = useState<string | null>(null);
  const [deptModalSelection, setDeptModalSelection] = useState<Department[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ users: AdminUserRow[] }>("/api/admin/users");
      setUsers(data.users);
      const roles: Record<string, "ADMIN" | "USER"> = {};
      const depts: Record<string, Department[]> = {};
      for (const u of data.users) {
        roles[u.id] = u.role;
        depts[u.id] = [...u.departments];
      }
      setRoleDraft(roles);
      setDepartmentDraft(depts);
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
        ...(newDepartments.length > 0 ? { departments: newDepartments } : {}),
      });
      setNewEmail("");
      setNewPassword("");
      setNewRole("USER");
      setNewDepartments([]);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  async function saveUser(userId: string) {
    const u = users?.find((x) => x.id === userId);
    if (!u) return;
    const role = roleDraft[userId] ?? u.role;
    const departments = departmentDraft[userId] ?? u.departments;
    const roleChanged = role !== u.role;
    const deptChanged = !deptsEqual(departments, u.departments);
    if (!roleChanged && !deptChanged) return;
    setSavingId(userId);
    setError(null);
    try {
      const body: { role?: "ADMIN" | "USER"; departments?: Department[] } = {};
      if (roleChanged) body.role = role;
      if (deptChanged) body.departments = departments;
      await api.patch(`/api/admin/users/${userId}`, body);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not update user.");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  function signInLabel(p: AuthProvider): string {
    return p === "LOCAL" ? "Email & password" : "Microsoft Entra ID";
  }

  function toggleNewDepartment(d: Department) {
    setNewDepartments((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function openDeptModal(u: AdminUserRow) {
    setDeptModalUserId(u.id);
    setDeptModalSelection([...(departmentDraft[u.id] ?? u.departments)]);
  }

  function closeDeptModal() {
    setDeptModalUserId(null);
    setDeptModalSelection([]);
  }

  function applyDeptModal() {
    if (deptModalUserId) {
      setDepartmentDraft((d) => ({ ...d, [deptModalUserId]: [...deptModalSelection] }));
    }
    closeDeptModal();
  }

  function toggleDeptModalDepartment(d: Department) {
    setDeptModalSelection((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  if (users === null) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  const deptModalUser = deptModalUserId ? users.find((x) => x.id === deptModalUserId) : null;

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
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
            Assign one or more departments per person. Anyone in <strong>System Administrator</strong> sees
            all onboarding programmes. Others only see programmes for departments they belong to.
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
          <form className="mt-4 flex flex-col gap-4" onSubmit={createUser}>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
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
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Departments</span>
              <div className="mt-2 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200/80 p-2 text-xs dark:border-slate-600 sm:grid-cols-2">
                {ALL_DEPARTMENTS.map((d) => (
                  <label key={d} className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={newDepartments.includes(d)}
                      onChange={() => toggleNewDepartment(d)}
                      className="accent-brand"
                    />
                    {DEPARTMENT_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
          </form>
        </section>

        <section className="card-surface overflow-hidden">
          <div className="border-b border-slate-200/80 px-6 py-4 dark:border-slate-700/80">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              All users ({users.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Sign-in</th>
                  <th className="px-6 py-3">Entra object ID</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Departments</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const draftRole = roleDraft[u.id] ?? u.role;
                  const draftDepts = departmentDraft[u.id] ?? u.departments;
                  const changed = draftRole !== u.role || !deptsEqual(draftDepts, u.departments);
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-brand-soft/30 dark:border-slate-800 dark:hover:bg-brand/10"
                    >
                      <td className="px-6 py-4 align-top">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{u.email}</span>
                        {me?.sub === u.id && (
                          <span className="ml-2 text-xs font-medium text-brand">(you)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-300">
                        {signInLabel(u.authProvider)}
                      </td>
                      <td className="px-6 py-4 align-top">
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
                      <td className="px-6 py-4 align-top">
                        <select
                          value={draftRole}
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
                      <td className="px-6 py-4 align-middle">
                        <p className="max-w-[16rem] text-xs leading-snug text-slate-600 dark:text-slate-300">
                          {departmentsSummaryLine(draftDepts)}
                        </p>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button type="button" onClick={() => openDeptModal(u)} className="btn-secondary-sm">
                            View
                          </button>
                          <button
                            type="button"
                            disabled={savingId === u.id || !changed}
                            onClick={() => void saveUser(u.id)}
                            className="btn-primary-sm shrink-0 disabled:opacity-40"
                          >
                            {savingId === u.id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No users yet.</p>
          )}
        </section>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <Link to="/admin/onboarding" className="link-brand">
            ← Onboarding programmes
          </Link>
        </p>
      </main>

      {deptModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
          role="presentation"
          onClick={closeDeptModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dept-modal-title"
            className="card-surface relative max-h-[85vh] w-full max-w-md overflow-y-auto p-6 shadow-2xl dark:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="dept-modal-title"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Departments
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{deptModalUser.email}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Tick the departments this person belongs to. Use <strong>Save</strong> on the row to persist
              changes to the server.
            </p>
            <div className="mt-4 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-slate-200/80 p-3 text-sm dark:border-slate-600 sm:grid-cols-2">
              {ALL_DEPARTMENTS.map((d) => (
                <label
                  key={d}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-brand-soft/40 dark:hover:bg-brand/10"
                >
                  <input
                    type="checkbox"
                    checked={deptModalSelection.includes(d)}
                    onChange={() => toggleDeptModalDepartment(d)}
                    className="accent-brand"
                  />
                  <span className="text-slate-800 dark:text-slate-100">{DEPARTMENT_LABELS[d]}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeDeptModal} className="btn-secondary text-sm">
                Cancel
              </button>
              <button type="button" onClick={applyDeptModal} className="btn-primary text-sm">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
