import {
  ALL_DEPARTMENTS,
  type Department,
  DEPARTMENT_LABELS,
} from "@manifest/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type QuizOption = { id: string; sortOrder: number; label: string; isCorrect: boolean };
type QuizQuestion = {
  id: string;
  sortOrder: number;
  prompt: string;
  options: QuizOption[];
};

type StepRow = {
  id: string;
  programId: string;
  sortOrder: number;
  kind: "LESSON" | "QUIZ";
  title: string;
  lessonContent: string | null;
  quizQuestions: QuizQuestion[];
};

type ProgramDetail = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  department: Department;
  steps: StepRow[];
};

type QuizQuestionDraft = {
  prompt: string;
  options: { label: string; isCorrect: boolean }[];
};

function validateQuizQuestions(quizQuestions: QuizQuestionDraft[]): boolean {
  for (const q of quizQuestions) {
    if (!q.prompt.trim()) return false;
    if (q.options.length < 2) return false;
    for (const o of q.options) {
      if (!o.label.trim()) return false;
    }
    if (q.options.filter((o) => o.isCorrect).length !== 1) return false;
  }
  return quizQuestions.length >= 1;
}

function stepToQuizDrafts(step: StepRow): QuizQuestionDraft[] {
  return step.quizQuestions.map((q) => ({
    prompt: q.prompt,
    options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
  }));
}

function QuizQuestionsEditor({
  questions,
  setQuestions,
  radioGroupPrefix,
}: {
  questions: QuizQuestionDraft[];
  setQuestions: React.Dispatch<React.SetStateAction<QuizQuestionDraft[]>>;
  radioGroupPrefix: string;
}) {
  return (
    <>
      {questions.map((q, qi) => (
        <div
          key={qi}
          className="rounded-xl border border-slate-200/80 bg-brand-soft/40 p-4 dark:border-slate-600 dark:bg-brand/10"
        >
          <div className="flex items-start justify-between gap-2">
            <label className="block flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Question {qi + 1}
              <input
                value={q.prompt}
                onChange={(e) => {
                  const next = [...questions];
                  next[qi] = { ...next[qi], prompt: e.target.value };
                  setQuestions(next);
                }}
                className="input-field mt-1"
              />
            </label>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => setQuestions(questions.filter((_, j) => j !== qi))}
                className="text-xs font-medium text-red-700/90 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${radioGroupPrefix}-correct-${qi}`}
                  checked={o.isCorrect}
                  className="accent-brand"
                  onChange={() => {
                    const next = [...questions];
                    next[qi] = {
                      ...next[qi],
                      options: next[qi].options.map((opt, k) => ({
                        ...opt,
                        isCorrect: k === oi,
                      })),
                    };
                    setQuestions(next);
                  }}
                />
                <input
                  value={o.label}
                  onChange={(e) => {
                    const next = [...questions];
                    const opts = [...next[qi].options];
                    opts[oi] = { ...opts[oi], label: e.target.value };
                    next[qi] = { ...next[qi], options: opts };
                    setQuestions(next);
                  }}
                  placeholder={`Option ${oi + 1}`}
                  className="input-field min-w-0 flex-1 py-1.5"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = [...questions];
                next[qi] = {
                  ...next[qi],
                  options: [...next[qi].options, { label: "", isCorrect: false }],
                };
                setQuestions(next);
              }}
              className="text-xs font-medium text-brand"
            >
              Add option
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setQuestions([
            ...questions,
            {
              prompt: "",
              options: [
                { label: "", isCorrect: true },
                { label: "", isCorrect: false },
              ],
            },
          ])
        }
        className="text-sm font-medium text-brand"
      >
        + Another question
      </button>
    </>
  );
}

export function AdminProgramEditorPage() {
  const navigate = useNavigate();
  const { programId } = useParams<{ programId: string }>();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublished, setEditPublished] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department>("OTHER");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [addingLesson, setAddingLesson] = useState(false);

  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([
    { prompt: "", options: [{ label: "", isCorrect: true }, { label: "", isCorrect: false }] },
  ]);
  const [addingQuiz, setAddingQuiz] = useState(false);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonBody, setEditLessonBody] = useState("");
  const [editQuizTitle, setEditQuizTitle] = useState("");
  const [editQuizQuestions, setEditQuizQuestions] = useState<QuizQuestionDraft[]>([]);
  const [savingStepEdit, setSavingStepEdit] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    setError(null);
    try {
      const { data } = await api.get<{ program: ProgramDetail }>(
        `/api/admin/onboarding/programs/${programId}`,
      );
      setProgram(data.program);
      setEditTitle(data.program.title);
      setEditDescription(data.program.description ?? "");
      setEditPublished(data.program.published);
      setEditDepartment(data.program.department);
    } catch {
      setError("Program not found or inaccessible.");
      setProgram(null);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  function beginEditLesson(step: StepRow) {
    setEditingStepId(step.id);
    setEditLessonTitle(step.title);
    setEditLessonBody(step.lessonContent ?? "");
  }

  function beginEditQuiz(step: StepRow) {
    setEditingStepId(step.id);
    setEditQuizTitle(step.title);
    setEditQuizQuestions(stepToQuizDrafts(step));
  }

  function cancelStepEdit() {
    setEditingStepId(null);
    setEditLessonTitle("");
    setEditLessonBody("");
    setEditQuizTitle("");
    setEditQuizQuestions([]);
  }

  async function saveLessonEdit(stepId: string) {
    if (!editLessonTitle.trim() || !editLessonBody.trim()) {
      setError("Lesson title and content are required.");
      return;
    }
    setSavingStepEdit(true);
    setError(null);
    try {
      await api.patch(`/api/admin/onboarding/steps/${stepId}`, {
        title: editLessonTitle.trim(),
        lessonContent: editLessonBody.trim(),
      });
      cancelStepEdit();
      await load();
    } catch {
      setError("Could not save lesson.");
    } finally {
      setSavingStepEdit(false);
    }
  }

  async function saveQuizEdit(stepId: string) {
    if (!editQuizTitle.trim() || !validateQuizQuestions(editQuizQuestions)) {
      setError(
        "Each quiz needs a title, at least one question, two options per question, and exactly one correct answer.",
      );
      return;
    }
    setSavingStepEdit(true);
    setError(null);
    try {
      await api.patch(`/api/admin/onboarding/steps/${stepId}`, {
        title: editQuizTitle.trim(),
        questions: editQuizQuestions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => ({
            label: o.label.trim(),
            isCorrect: o.isCorrect,
          })),
        })),
      });
      cancelStepEdit();
      await load();
    } catch {
      setError("Could not save quiz.");
    } finally {
      setSavingStepEdit(false);
    }
  }

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!programId) return;
    setSavingMeta(true);
    setError(null);
    try {
      await api.patch(`/api/admin/onboarding/programs/${programId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        published: editPublished,
        department: editDepartment,
      });
      await load();
    } catch {
      setError("Could not save program.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!programId || !lessonTitle.trim() || !lessonContent.trim()) return;
    setAddingLesson(true);
    setError(null);
    try {
      await api.post(`/api/admin/onboarding/programs/${programId}/steps`, {
        kind: "LESSON",
        title: lessonTitle.trim(),
        lessonContent: lessonContent.trim(),
      });
      setLessonTitle("");
      setLessonContent("");
      await load();
    } catch {
      setError("Could not add lesson step.");
    } finally {
      setAddingLesson(false);
    }
  }

  async function addQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!programId || !quizTitle.trim() || !validateQuizQuestions(quizQuestions)) {
      setError(
        "Each quiz needs a title, at least one question, two options per question, and exactly one correct answer.",
      );
      return;
    }
    setAddingQuiz(true);
    setError(null);
    try {
      await api.post(`/api/admin/onboarding/programs/${programId}/steps`, {
        kind: "QUIZ",
        title: quizTitle.trim(),
        questions: quizQuestions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => ({
            label: o.label.trim(),
            isCorrect: o.isCorrect,
          })),
        })),
      });
      setQuizTitle("");
      setQuizQuestions([
        { prompt: "", options: [{ label: "", isCorrect: true }, { label: "", isCorrect: false }] },
      ]);
      await load();
    } catch {
      setError("Could not add quiz step.");
    } finally {
      setAddingQuiz(false);
    }
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Delete this step? Enrolled users may be affected.")) return;
    if (editingStepId === stepId) cancelStepEdit();
    setError(null);
    try {
      await api.delete(`/api/admin/onboarding/steps/${stepId}`);
      await load();
    } catch {
      setError("Could not delete step.");
    }
  }

  async function moveStep(index: number, dir: -1 | 1) {
    if (!program) return;
    const steps = [...program.steps];
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[index], next[j]] = [next[j], next[index]];
    try {
      await api.post(`/api/admin/onboarding/programs/${program.id}/steps/reorder`, {
        orderedStepIds: next.map((s) => s.id),
      });
      await load();
    } catch {
      setError("Could not reorder steps.");
    }
  }

  async function deleteProgram() {
    if (!programId || !confirm("Delete this program and all steps and enrollments?")) return;
    try {
      await api.delete(`/api/admin/onboarding/programs/${programId}`);
      navigate("/admin/onboarding");
    } catch {
      setError("Could not delete program.");
    }
  }

  if (!program && error) {
    return (
      <div className="px-4 py-12 text-center text-sm text-red-600 dark:text-red-400">
        {error}
        <Link to="/admin/onboarding" className="link-brand mt-4 block">
          ← Back
        </Link>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-600 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full pb-16">
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/admin/onboarding"
              className="text-sm text-slate-600 transition hover:text-brand dark:text-slate-300"
            >
              ← Programs
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              Edit program
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void deleteProgram()}
            className="text-sm font-medium text-red-700/90 transition hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete program
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <form
          onSubmit={saveMeta}
          className="card-surface space-y-4 p-6 sm:p-8"
        >
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Details</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Title</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Department (who can see this programme when published)
            </label>
            <select
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value as Department)}
              className="input-field mt-1 max-w-md"
            >
              {ALL_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={editPublished}
              onChange={(e) => setEditPublished(e.target.checked)}
            />
            Published (visible to users in this department, or anyone in System Administrator)
          </label>
          <button
            type="submit"
            disabled={savingMeta}
            className="btn-primary"
          >
            {savingMeta ? "Saving…" : "Save details"}
          </button>
        </form>

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Steps</h2>
          <ol className="mt-4 space-y-4">
            {program.steps.map((s, i) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200/60 bg-white/90 px-3 py-3 shadow-sm dark:border-slate-600/60 dark:bg-slate-800/80"
              >
                {editingStepId === s.id && s.kind === "LESSON" ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {i + 1}. LESSON — edit content
                    </p>
                    <input
                      value={editLessonTitle}
                      onChange={(e) => setEditLessonTitle(e.target.value)}
                      className="input-field"
                      placeholder="Step title"
                    />
                    <textarea
                      value={editLessonBody}
                      onChange={(e) => setEditLessonBody(e.target.value)}
                      rows={6}
                      className="input-field"
                      placeholder="Lesson content"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingStepEdit}
                        onClick={() => void saveLessonEdit(s.id)}
                        className="btn-primary-sm"
                      >
                        {savingStepEdit ? "Saving…" : "Save lesson"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelStepEdit}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : editingStepId === s.id && s.kind === "QUIZ" ? (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {i + 1}. QUIZ — edit content
                    </p>
                    <input
                      value={editQuizTitle}
                      onChange={(e) => setEditQuizTitle(e.target.value)}
                      className="input-field"
                      placeholder="Quiz title"
                    />
                    <QuizQuestionsEditor
                      questions={editQuizQuestions}
                      setQuestions={setEditQuizQuestions}
                      radioGroupPrefix={`edit-${s.id}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingStepEdit}
                        onClick={() => void saveQuizEdit(s.id)}
                        className="btn-primary-sm"
                      >
                        {savingStepEdit ? "Saving…" : "Save quiz"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelStepEdit}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {i + 1}. {s.kind}
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{s.title}</p>
                      {s.kind === "LESSON" && s.lessonContent && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                          {s.lessonContent}
                        </p>
                      )}
                      {s.kind === "QUIZ" && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {s.quizQuestions.length} question(s)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          s.kind === "LESSON" ? beginEditLesson(s) : beginEditQuiz(s)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand/35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveStep(i, -1)}
                        disabled={i === 0}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/80"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveStep(i, 1)}
                        disabled={i === program.steps.length - 1}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/80"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteStep(s.id)}
                        className="rounded-lg border border-red-200/80 bg-red-50/50 px-2 py-1 text-xs font-medium text-red-800 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {program.steps.length === 0 && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No steps yet. Add a lesson or quiz below.</p>
          )}
        </section>

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Add lesson step</h2>
          <form className="mt-4 space-y-3" onSubmit={addLesson}>
            <input
              placeholder="Step title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="input-field"
            />
            <textarea
              placeholder="Content (plain text — line breaks preserved)"
              value={lessonContent}
              onChange={(e) => setLessonContent(e.target.value)}
              rows={6}
              className="input-field"
            />
            <button
              type="submit"
              disabled={addingLesson}
              className="btn-primary"
            >
              {addingLesson ? "Adding…" : "Add lesson"}
            </button>
          </form>
        </section>

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Add quiz step</h2>
          <form className="mt-4 space-y-6" onSubmit={addQuiz}>
            <input
              placeholder="Quiz title"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="input-field"
            />
            <QuizQuestionsEditor
              questions={quizQuestions}
              setQuestions={setQuizQuestions}
              radioGroupPrefix="new-quiz"
            />
            <div>
              <button
                type="submit"
                disabled={addingQuiz}
                className="btn-primary"
              >
                {addingQuiz ? "Adding…" : "Add quiz"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
