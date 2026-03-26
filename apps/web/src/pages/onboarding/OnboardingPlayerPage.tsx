import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type OutlineStep = {
  id: string;
  sortOrder: number;
  kind: "LESSON" | "QUIZ";
  title: string;
  completed: boolean;
};

type LessonStep = { id: string; kind: "LESSON"; title: string; lessonContent: string };
type QuizStep = {
  id: string;
  kind: "QUIZ";
  title: string;
  questions: { id: string; prompt: string; options: { id: string; label: string }[] }[];
};

type PlayerPayload = {
  program: { id: string; title: string; description: string | null };
  enrollment: {
    id: string;
    status: "IN_PROGRESS" | "COMPLETED";
    currentStepIndex: number;
    totalSteps?: number;
    completedAt?: string | null;
  };
  stepsOutline: OutlineStep[];
  currentStep: LessonStep | QuizStep | null;
  completed: boolean;
};

export function OnboardingPlayerPage() {
  const { programId } = useParams<{ programId: string }>();
  const [data, setData] = useState<PlayerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!programId) return;
    setError(null);
    try {
      const { data: res } = await api.get<PlayerPayload>(`/api/onboarding/programs/${programId}/player`);
      setData(res);
      setQuizAnswers({});
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: string } } };
      if (ax.response?.status === 400 && ax.response?.data?.error === "Start the program first") {
        setData(null);
        setError("start-first");
        return;
      }
      setError(ax.response?.data?.error ?? "Could not load this program.");
      setData(null);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startProgram() {
    if (!programId) return;
    setStartError(null);
    try {
      await api.post(`/api/onboarding/programs/${programId}/start`);
      await load();
    } catch {
      setStartError("Could not start. Try again.");
    }
  }

  async function completeCurrent() {
    if (!programId || !data?.currentStep) return;
    setSubmitting(true);
    setError(null);
    try {
      const body =
        data.currentStep.kind === "QUIZ"
          ? { answers: quizAnswers }
          : {};
      const { data: res } = await api.post<{
        completedProgram: boolean;
        enrollment: { status: string; currentStepIndex: number; completedAt?: string | null };
      }>(`/api/onboarding/programs/${programId}/complete-step`, body);

      if (res.completedProgram) {
        await load();
      } else {
        await load();
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not complete this step.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error === "start-first") {
    return (
      <div className="min-h-0 flex-1 bg-transparent px-4 py-12 dark:bg-slate-950">
        <div className="card-surface mx-auto max-w-lg p-8 text-center">
            <h1 className="text-2xl font-medium text-slate-800 dark:text-slate-100">Get started</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Start this onboarding to track your progress.
          </p>
          {startError && <p className="mt-4 text-sm text-red-600">{startError}</p>}
          <button
            type="button"
            onClick={() => void startProgram()}
            className="btn-primary mt-6"
          >
            Start onboarding
          </button>
          <div className="mt-6">
            <Link
              to="/onboarding"
              className="text-sm text-slate-600 transition hover:text-brand dark:text-slate-300"
            >
              ← All programs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data && error && error !== "start-first") {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          to="/onboarding"
          className="mt-4 inline-block text-sm text-slate-600 hover:underline dark:text-slate-300"
        >
          Back to onboarding
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-transparent text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  const { program, stepsOutline, currentStep, completed } = data;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent dark:bg-slate-950">
      <header className="border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link
              to="/onboarding"
              className="text-sm font-medium text-slate-600 transition hover:text-brand dark:text-slate-300"
            >
              ← All programs
            </Link>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100 md:text-[1.75rem]">
              {program.title}
            </h1>
          </div>
          {completed && <span className="badge-complete">Completed</span>}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Steps
          </h2>
          <ol className="mt-3 space-y-2">
            {stepsOutline.map((s, i) => (
              <li
                key={s.id}
                className={`rounded-xl border px-3 py-2.5 text-base shadow-sm ${
                  s.completed
                    ? "border-slate-300/70 bg-slate-100/80 text-slate-800 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
                    : "border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                }`}
              >
                <span className="text-slate-500 dark:text-slate-400">{i + 1}.</span> {s.title}
                <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">
                  {s.kind === "QUIZ" ? "(quiz)" : ""}
                </span>
              </li>
            ))}
          </ol>
        </aside>

        <main className="card-surface min-w-0 flex-1 p-6 sm:p-8">
          {error && error !== "start-first" && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          {completed && (
            <div className="text-center">
              <p className="text-xl font-medium text-slate-800 dark:text-slate-100">
                You have finished this onboarding.
              </p>
              <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                You can review material any time from the onboarding list.
              </p>
              <Link
                to="/onboarding"
                className="btn-primary mt-6 inline-flex"
              >
                Back to programs
              </Link>
            </div>
          )}

          {!completed && currentStep?.kind === "LESSON" && (
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                {currentStep.title}
              </h2>
              <div className="mt-5 whitespace-pre-wrap text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                {currentStep.lessonContent}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void completeCurrent()}
                className="btn-primary mt-8"
              >
                {submitting ? "Saving…" : "Mark complete and continue"}
              </button>
            </div>
          )}

          {!completed && currentStep?.kind === "QUIZ" && (
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                {currentStep.title}
              </h2>
              <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">Answer every question to continue.</p>
              <div className="mt-6 space-y-8">
                {currentStep.questions.map((q) => (
                  <fieldset key={q.id} className="space-y-3">
                    <legend className="text-lg font-medium text-slate-800 dark:text-slate-100">
                      {q.prompt}
                    </legend>
                    <div className="space-y-2">
                      {q.options.map((o) => (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 transition hover:border-brand/30 hover:bg-brand-light/30 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-brand/40 dark:hover:bg-brand/10"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={quizAnswers[q.id] === o.id}
                            onChange={() =>
                              setQuizAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                            }
                            className="mt-1 accent-brand"
                          />
                          <span className="text-base text-slate-800 dark:text-slate-100">{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <button
                type="button"
                disabled={
                  submitting ||
                  currentStep.questions.some((q) => !quizAnswers[q.id])
                }
                onClick={() => void completeCurrent()}
                className="btn-primary mt-8"
              >
                {submitting ? "Checking…" : "Submit answers"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
