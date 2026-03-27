import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type EnrollmentSummary = {
  status: "IN_PROGRESS" | "COMPLETED";
  currentStepIndex: number;
  startedAt: string;
  completedAt: string | null;
} | null;

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  stepCount: number;
  enrollment: EnrollmentSummary;
};

export function OnboardingListPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<{ programs: ProgramRow[] }>("/api/onboarding/programs");
        setPrograms(data.programs);
      } catch {
        setError("Could not load onboarding programs.");
      }
    })();
  }, []);

  async function startOrOpen(programId: string) {
    setStarting(programId);
    setError(null);
    try {
      await api.post(`/api/onboarding/programs/${programId}/start`);
      navigate(`/onboarding/${programId}`);
    } catch {
      setError("Could not start onboarding.");
    } finally {
      setStarting(null);
    }
  }

  if (programs === null && !error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-transparent text-base text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden
        />
        Loading programmes…
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 bg-transparent dark:bg-slate-950">
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 md:space-y-12 md:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/80 p-8 text-left shadow-program backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900 md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-brand/25 via-brand/10 to-transparent blur-2xl dark:from-brand/30" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-brand/5 blur-3xl dark:bg-brand/10" />
          <div className="relative flex flex-col items-stretch gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-4 text-left">
              <p className="inline-flex w-fit rounded-full border border-brand/25 bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand dark:border-brand/35 dark:bg-brand/15 dark:text-brand-muted">
                Learning programmes
              </p>
              <h1 className="text-left text-md-headline font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-[2.25rem] md:leading-[2.75rem]">
                Onboarding
              </h1>
              <p className="text-left text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Open a programme to learn in steps. Your progress is saved automatically.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-base text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <ul className="space-y-5">
          {programs?.map((p) => {
            const en = p.enrollment;
            const label = !en
              ? "Not started"
              : en.status === "COMPLETED"
                ? "Completed"
                : `In progress — step ${en.currentStepIndex + 1} of ${p.stepCount}`;
            const badgeClass =
              en?.status === "COMPLETED"
                ? "badge-complete"
                : en
                  ? "badge-in-progress"
                  : "badge-draft";
            return (
              <li
                key={p.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/85 shadow-program backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-program-hover dark:border-slate-700/85 dark:bg-slate-900 dark:hover:border-brand/40"
              >
                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-brand via-brand-hover to-brand-muted opacity-90" />
                <div className="flex flex-col items-stretch gap-6 p-6 pl-7 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8 sm:pl-9">
                  <div className="min-w-0 flex-1 space-y-2 text-left">
                    <h2 className="text-left text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                      {p.title}
                    </h2>
                    {p.description && (
                      <p className="text-left text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                        {p.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-start gap-2 pt-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100/90 px-3 py-1 text-sm font-medium text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                        {p.stepCount} steps
                      </span>
                      <span className={badgeClass}>{label}</span>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
                    {!en ? (
                      <button
                        type="button"
                        onClick={() => void startOrOpen(p.id)}
                        disabled={starting === p.id || p.stepCount === 0}
                        className="btn-primary flex w-full min-h-[3rem] items-center justify-center px-8 sm:w-auto sm:min-w-[11rem]"
                      >
                        {starting === p.id ? "Starting…" : "Start"}
                      </button>
                    ) : (
                      <Link
                        to={`/onboarding/${p.id}`}
                        className="btn-primary flex w-full min-h-[3rem] items-center justify-center px-8 sm:w-auto sm:min-w-[11rem]"
                      >
                        {en.status === "COMPLETED" ? "Review" : "Continue"}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {programs?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300/90 bg-white/50 py-16 text-center dark:border-slate-600 dark:bg-slate-900/40">
            <p className="text-lg text-slate-600 dark:text-slate-300">
              No published onboarding programmes match your departments, or none are published yet.
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              People in <strong>System Administrator</strong> see every programme; others only see content for
              their assigned departments.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
