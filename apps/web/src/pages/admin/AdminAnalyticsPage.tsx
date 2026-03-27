import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CompletionsAreaChart,
  type CompletionsTimelineRow,
} from "../../components/CompletionsAreaChart";
import { api } from "../../lib/api";

type AnalyticsResponse = {
  totals: {
    users: number;
    publishedProgrammes: number;
    learnersWithEnrollment: number;
    totalEnrollments: number;
    enrollmentsCompleted: number;
    enrollmentsInProgress: number;
  };
  programmeStats: {
    programId: string;
    title: string;
    published: boolean;
    enrollmentCount: number;
    completedCount: number;
    inProgressCount: number;
  }[];
  topCompleters: {
    userId: string;
    completedProgrammes: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }[];
  recentCompletions: {
    completedAt: string;
    programmeTitle: string;
    userEmail: string;
    userFirstName: string | null;
    userLastName: string | null;
  }[];
  completionsByMonth: { month: string; label: string; count: number }[];
};

function displayUser(firstName: string | null, lastName: string | null, email: string): string {
  const f = firstName?.trim();
  const l = lastName?.trim();
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  return email;
}

export function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: d } = await api.get<AnalyticsResponse>("/api/admin/analytics");
      setData(d);
    } catch {
      setError("Could not load analytics.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const areaData = useMemo((): CompletionsTimelineRow[] => {
    if (!data?.completionsByMonth.length) {
      return [{ label: "—", count: 0 }];
    }
    return data.completionsByMonth.map((r) => ({ label: r.label, count: r.count }));
  }, [data]);

  const maxProgramEnrollments = useMemo(() => {
    if (!data?.programmeStats.length) return 1;
    return Math.max(1, ...data.programmeStats.map((p) => p.enrollmentCount));
  }, [data]);

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
            Analytics
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Organisation-wide onboarding usage: enrolments, completions, and active learners.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {!data && !error && (
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
              aria-hidden
            />
            Loading analytics…
          </div>
        )}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="card-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Users
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {data.totals.users}
                </p>
              </div>
              <div className="card-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Learners with activity
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {data.totals.learnersWithEnrollment}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  At least one programme enrolment
                </p>
              </div>
              <div className="card-surface p-5 sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Enrolments
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {data.totals.totalEnrollments}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {data.totals.enrollmentsCompleted} completed
                  </span>
                  {" · "}
                  <span className="font-medium text-brand dark:text-brand-muted">
                    {data.totals.enrollmentsInProgress} in progress
                  </span>
                </p>
              </div>
            </section>

            <section className="card-surface p-5 shadow-md sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Completions by month
                </h2>
                <span className="w-fit rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  All users
                </span>
              </div>
              <CompletionsAreaChart
                data={areaData}
                ariaLabel="Organisation programme completions by month"
                countLabel="completion(s)"
              />
              {data.completionsByMonth.length === 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No completions yet.</p>
              )}
            </section>

            <section className="card-surface overflow-hidden shadow-md">
              <div className="border-b border-slate-200/80 px-6 py-4 dark:border-slate-700/80">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Programme usage
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Enrolments per programme (published and draft)
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.programmeStats.map((p) => (
                  <div key={p.programId} className="px-6 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{p.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {p.published ? "Published" : "Draft"} · {p.enrollmentCount} enrolled ·{" "}
                          {p.completedCount} completed · {p.inProgressCount} in progress
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${(p.enrollmentCount / maxProgramEnrollments) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {data.programmeStats.length === 0 && (
                  <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No programmes yet.
                  </p>
                )}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card-surface p-5 shadow-md sm:p-6">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Top completers
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Users with the most completed programmes
                </p>
                <ol className="mt-4 space-y-3">
                  {data.topCompleters.map((row, i) => (
                    <li
                      key={row.userId}
                      className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800"
                    >
                      <span className="text-sm text-slate-600 dark:text-slate-400">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {displayUser(row.firstName, row.lastName, row.email)}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
                      </div>
                      <span className="shrink-0 tabular-nums text-sm font-semibold text-brand">
                        {row.completedProgrammes}
                      </span>
                    </li>
                  ))}
                </ol>
                {data.topCompleters.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No completions yet.</p>
                )}
              </section>

              <section className="card-surface p-5 shadow-md sm:p-6">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Recent completions
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest 25 finishes</p>
                <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                  {data.recentCompletions.map((r, i) => (
                    <li
                      key={`${r.completedAt}-${r.userEmail}-${i}`}
                      className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <p className="font-medium text-slate-800 dark:text-slate-100">{r.programmeTitle}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {displayUser(r.userFirstName, r.userLastName, r.userEmail)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {new Date(r.completedAt).toLocaleString("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
                {data.recentCompletions.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No completions yet.</p>
                )}
              </section>
            </div>
          </>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <Link to="/admin/users" className="link-brand">
            ← Users
          </Link>
          {" · "}
          <Link to="/admin/onboarding" className="link-brand">
            Onboarding programmes
          </Link>
        </p>
      </main>
    </div>
  );
}
