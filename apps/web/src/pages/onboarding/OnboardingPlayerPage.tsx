import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LessonContentView } from "../../components/LessonContentView";
import { api } from "../../lib/api";

type OutlineStep = {
  id: string;
  sortOrder: number;
  kind: "LESSON" | "QUIZ" | "SUMMARY";
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
type ReviewQuizStep = QuizStep & { savedAnswers: Record<string, string> };
type ReviewStep = LessonStep | ReviewQuizStep;

type QuizSummaryPayload = {
  correctCount: number;
  questionCount: number;
  overallPercent: number;
  quizzes: { title: string; correct: number; total: number }[];
};

type SummaryStep = {
  kind: "SUMMARY";
  completionPercent: number;
  quizSummary: QuizSummaryPayload | null;
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
  currentStep: LessonStep | QuizStep | SummaryStep | null;
  /** Present when the programme is completed — same figures as the pre-finish summary. */
  completionSummary?: {
    completionPercent: number;
    quizSummary: QuizSummaryPayload | null;
  };
  reviewSteps?: ReviewStep[];
  completed: boolean;
};

function OnboardingResultsStats({
  completionPercent,
  quizSummary,
}: {
  completionPercent: number;
  quizSummary: QuizSummaryPayload | null;
}) {
  return (
    <>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {completionPercent}%{" "}
        <span className="text-lg font-medium text-slate-600 dark:text-slate-300">complete</span>
      </p>
      {quizSummary && (
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Quiz scores</h3>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Overall: {quizSummary.correctCount} / {quizSummary.questionCount} correct ({quizSummary.overallPercent}%)
          </p>
          <ul className="space-y-3">
            {quizSummary.quizzes.map((q, qi) => (
              <li
                key={`${q.title}-${qi}`}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800/40"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{q.title}</span>
                <span className="mt-1 block text-base tabular-nums text-slate-600 dark:text-slate-300">
                  {q.correct} / {q.total} correct{" "}
                  {q.total > 0 ? `(${Math.round((q.correct / q.total) * 100)}%)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function OnboardingPlayerPage() {
  const { programId } = useParams<{ programId: string }>();
  const [data, setData] = useState<PlayerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [reviewStepIndex, setReviewStepIndex] = useState(0);

  const load = useCallback(async () => {
    if (!programId) return;
    setError(null);
    try {
      const { data: res } = await api.get<PlayerPayload>(`/api/onboarding/programs/${programId}/player`);
      setData(res);
      setQuizAnswers({});
      setReviewStepIndex(0);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: string } } };
      if (ax.response?.status === 400 && ax.response?.data?.error === "Start the programme first") {
        setData(null);
        setError("start-first");
        return;
      }
      setError(ax.response?.data?.error ?? "Could not load this programme.");
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
        data.currentStep.kind === "SUMMARY"
          ? { finish: true as const }
          : data.currentStep.kind === "QUIZ"
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
              ← All programmes
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

  const { program, stepsOutline, currentStep, completed, reviewSteps, enrollment, completionSummary } = data;
  const reviewList = completed && reviewSteps?.length ? reviewSteps : null;
  const reviewSummaryFirst = stepsOutline[0]?.id === "__review_summary__";
  const onReviewSummary =
    Boolean(reviewList) && stepsOutline[reviewStepIndex]?.id === "__review_summary__";
  const contentReviewIndex = reviewSummaryFirst ? reviewStepIndex - 1 : reviewStepIndex;
  const activeReviewStep =
    reviewList &&
    !onReviewSummary &&
    contentReviewIndex >= 0 &&
    contentReviewIndex < reviewList.length
      ? reviewList[contentReviewIndex]
      : null;

  const completionSummaryFirst = stepsOutline[0]?.id === "__completion_summary__";
  const totalProgramSteps = enrollment.totalSteps ?? 0;

  function outlineKindLabel(kind: OutlineStep["kind"]) {
    if (kind === "QUIZ") return "(quiz)";
    if (kind === "SUMMARY") return "(summary)";
    return "";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent dark:bg-slate-950">
      <header className="border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link
              to="/onboarding"
              className="text-sm font-medium text-slate-600 transition hover:text-brand dark:text-slate-300"
            >
              ← All programmes
            </Link>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100 md:text-[1.75rem]">
              {program.title}
            </h1>
          </div>
          {completed && <span className="badge-complete">Completed</span>}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Steps
          </h2>
          <ol className="mt-3 space-y-2">
            {stepsOutline.map((s, i) => {
              const isReviewActive = reviewList !== null && reviewStepIndex === i;
              const isProgressCurrent =
                !completed &&
                !reviewList &&
                (s.id === "__completion_summary__"
                  ? enrollment.currentStepIndex === totalProgramSteps
                  : completionSummaryFirst
                    ? enrollment.currentStepIndex === i - 1
                    : enrollment.currentStepIndex === i);
              const rowClass = s.completed
                ? "border-slate-300/70 bg-slate-100/80 text-slate-800 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
                : "border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100";
              const activeRing = isReviewActive
                ? "ring-2 ring-brand/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                : "";
              const progressRing = isProgressCurrent
                ? "ring-2 ring-brand/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                : "";
              const kindSuffix = outlineKindLabel(s.kind);
              if (reviewList) {
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setReviewStepIndex(i)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-base shadow-sm transition ${rowClass} ${activeRing}`}
                    >
                      <span className="text-slate-500 dark:text-slate-400">{i + 1}.</span> {s.title}
                      {kindSuffix ? (
                        <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">{kindSuffix}</span>
                      ) : null}
                    </button>
                  </li>
                );
              }
              return (
                <li
                  key={s.id}
                  className={`rounded-xl border px-3 py-2.5 text-base shadow-sm ${rowClass} ${progressRing}`}
                >
                  <span className="text-slate-500 dark:text-slate-400">{i + 1}.</span> {s.title}
                  {kindSuffix ? (
                    <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">{kindSuffix}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="card-surface min-w-0 flex-1 p-6 sm:p-8">
          {error && error !== "start-first" && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          {completed && reviewList && onReviewSummary && (
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/35">
              <p className="text-lg font-medium text-emerald-950 dark:text-emerald-100">
                You've completed this onboarding.
              </p>
              <p className="mt-1.5 text-base leading-relaxed text-emerald-900/85 dark:text-emerald-200/85">
                Select a step above to review lessons and quizzes. Content is read-only.
              </p>
              {completionSummary && (
                <div className="mt-6 border-t border-emerald-200/70 pt-6 dark:border-emerald-800/50">
                  <h3 className="text-base font-semibold text-emerald-950 dark:text-emerald-100">Your results</h3>
                  <OnboardingResultsStats
                    completionPercent={completionSummary.completionPercent}
                    quizSummary={completionSummary.quizSummary}
                  />
                </div>
              )}
              <div className="mt-8 border-t border-emerald-200/70 pt-6 dark:border-emerald-800/50">
                <Link
                  to="/onboarding"
                  className="text-sm font-medium text-emerald-900/90 transition hover:text-emerald-700 dark:text-emerald-200 dark:hover:text-emerald-100"
                >
                  ← Back to all programmes
                </Link>
              </div>
            </div>
          )}

          {completed && activeReviewStep?.kind === "LESSON" && (
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Review (read-only)</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                {activeReviewStep.title}
              </h2>
              <LessonContentView content={activeReviewStep.lessonContent} className="mt-5" />
              <div className="mt-10 border-t border-slate-200/80 pt-8 dark:border-slate-700">
                <Link
                  to="/onboarding"
                  className="text-sm font-medium text-slate-600 transition hover:text-brand dark:text-slate-300"
                >
                  ← Back to all programmes
                </Link>
              </div>
            </div>
          )}

          {completed && activeReviewStep?.kind === "QUIZ" && (
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Review (read-only)</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                {activeReviewStep.title}
              </h2>
              <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">Your submitted answers.</p>
              <div className="mt-6 space-y-8">
                {activeReviewStep.questions.map((q) => {
                  const chosen = activeReviewStep.savedAnswers[q.id];
                  return (
                    <fieldset key={q.id} className="space-y-3">
                      <legend className="text-lg font-medium text-slate-800 dark:text-slate-100">
                        {q.prompt}
                      </legend>
                      <div className="space-y-2">
                        {q.options.map((o) => (
                          <label
                            key={o.id}
                            className="flex cursor-default items-start gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/40"
                          >
                            <input
                              type="radio"
                              name={`review-${q.id}`}
                              checked={chosen === o.id}
                              readOnly
                              disabled
                              className="mt-1 accent-brand"
                            />
                            <span className="text-base text-slate-800 dark:text-slate-100">{o.label}</span>
                          </label>
                        ))}
                      </div>
                      {!chosen && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Response was not recorded for this step.
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
              <div className="mt-10 border-t border-slate-200/80 pt-8 dark:border-slate-700">
                <Link
                  to="/onboarding"
                  className="text-sm font-medium text-slate-600 transition hover:text-brand dark:text-slate-300"
                >
                  ← Back to all programmes
                </Link>
              </div>
            </div>
          )}

          {completed && !reviewList && (
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
                Back to programmes
              </Link>
            </div>
          )}

          {!completed && currentStep?.kind === "SUMMARY" && (
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                Your results
              </h2>
              <OnboardingResultsStats
                completionPercent={currentStep.completionPercent}
                quizSummary={currentStep.quizSummary}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => void completeCurrent()}
                className="btn-primary mt-10"
              >
                {submitting ? "Saving…" : "Finish onboarding"}
              </button>
            </div>
          )}

          {!completed && currentStep?.kind === "LESSON" && (
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">
                {currentStep.title}
              </h2>
              <LessonContentView content={currentStep.lessonContent} className="mt-5" />
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
