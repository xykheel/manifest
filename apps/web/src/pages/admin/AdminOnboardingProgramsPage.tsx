import {
  ALL_DEPARTMENTS,
  type Department,
  DEPARTMENT_LABELS,
} from "@manifest/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type ProgramSummary = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  department: Department;
  stepCount: number;
  enrollmentCount: number;
  updatedAt: string;
};

export function AdminOnboardingProgramsPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState<Department>("OTHER");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const { data } = await api.get<{ programs: ProgramSummary[] }>(
        "/api/admin/onboarding/programs",
      );
      setPrograms(data.programs);
    } catch {
      setError("Could not load programmes.");
      setPrograms([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { data } = await api.post<{ program: { id: string } }>(
        "/api/admin/onboarding/programs",
        { title: title.trim(), department },
      );
      setTitle("");
      await load();
      navigate(`/admin/onboarding/${data.program.id}`);
    } catch {
      setError("Could not create programme.");
    } finally {
      setCreating(false);
    }
  }

  if (programs === null) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-600 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to="/admin/users" className="link-brand">
              ← Users
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Onboarding programmes
          </h1>
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">New programme</h2>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={createProgram}>
            <div className="min-w-0 flex-1">
              <label htmlFor="new-title" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Title
              </label>
              <input
                id="new-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field mt-1"
                placeholder="e.g. New hire — week one"
              />
            </div>
            <div className="w-full sm:w-56">
              <label htmlFor="new-dept" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Department
              </label>
              <select
                id="new-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="input-field mt-1"
              >
                {ALL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="btn-primary"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            All programmes
          </h2>
          <ul className="mt-3 space-y-2">
            {programs.map((p) => (
              <li
                key={p.id}
                className="card-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <Link
                    to={`/admin/onboarding/${p.id}`}
                    className="font-medium text-slate-800 transition hover:text-brand dark:text-slate-100"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {DEPARTMENT_LABELS[p.department]} · {p.stepCount} steps · {p.enrollmentCount}{" "}
                    enrollments ·{" "}
                    {p.published ? (
                      <span className="font-medium text-brand-hover">Published</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">Draft</span>
                    )}
                  </p>
                </div>
                <Link
                  to={`/admin/onboarding/${p.id}`}
                  className="link-brand text-sm"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
          {programs.length === 0 && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No programmes yet. Create one above.</p>
          )}
        </section>
      </main>
    </div>
  );
}
