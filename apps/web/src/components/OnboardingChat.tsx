import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, baseURL } from "../lib/api";
import { tokenStore } from "../lib/tokenStore";
import { useVoiceMode } from "../hooks/useVoiceMode";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  divider?: boolean;
  celebration?: boolean;
};

function genId() {
  return Math.random().toString(36).slice(2);
}

function RobotAvatar() {
  return (
    <span
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20"
      aria-hidden
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="5" y="9" width="14" height="10" rx="2" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h.01M15 13h.01M9 17h6" />
        <path strokeLinecap="round" d="M12 9V6" />
        <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
        <path strokeLinecap="round" d="M5 13H3M21 13h-2" />
      </svg>
    </span>
  );
}

function CelebrationCard({ programTitle }: { programTitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-5 shadow-md dark:border-amber-500/20 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/40">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-3xl shadow-lg">
          🏆
        </span>
        <div>
          <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
            Programme Complete!
          </p>
          {programTitle && (
            <p className="mt-0.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {programTitle}
            </p>
          )}
        </div>
        <p className="max-w-[18rem] text-sm text-amber-800/80 leading-relaxed dark:text-amber-200/80">
          Outstanding work — you've finished every step. Your dedication and effort have paid off!
        </p>
        <div className="mt-1 flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Head back to the onboarding page to check for more programmes
        </div>
      </div>
    </div>
  );
}

function BotIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  );
}

function MicOffIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM8.25 4.5a3.75 3.75 0 017.5 0v4.94l-7.5-7.5v2.56zM15.75 12.75v-1.94l1.5 1.5v.44a.75.75 0 01-1.5 0zm-9-1.5v1.5a5.25 5.25 0 007.88 4.55l1.12 1.12a6.733 6.733 0 01-3 1.24v2.09h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.09a6.751 6.751 0 01-6-6.71v-1.5a.75.75 0 011.5 0zm3-3.75l6 6v-.75a3.75 3.75 0 00-6-3V7.5z" />
    </svg>
  );
}

function SpinnerDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Thinking…">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
          style={{ animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white shadow-sm">
        {content}
      </div>
    </div>
  );
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className="block overflow-x-auto rounded-lg bg-black/10 px-3 py-2 font-mono text-xs dark:bg-white/10">
        {children}
      </code>
    ) : (
      <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs dark:bg-white/10">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/10 p-3 last:mb-0 dark:bg-white/10">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 opacity-80 hover:opacity-100">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-current pl-3 opacity-80 last:mb-0">
      {children}
    </blockquote>
  ),
};

function AssistantBubble({ content, error }: { content: string; error?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <RobotAvatar />
      <div
        className={`min-w-0 flex-1 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm shadow-sm ${
          error
            ? "border border-red-200/80 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
        }`}
      >
        {error ? (
          <p className="leading-relaxed">{content}</p>
        ) : (
          <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

/** Strip markdown formatting for cleaner TTS output */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

/**
 * Directly speak text using the browser's speechSynthesis API.
 * Returns a promise that resolves when speaking finishes (or immediately if unavailable).
 */
function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const plain = stripMarkdown(text);
    if (!plain) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === "en-AU") ??
      voices.find((v) => v.lang.startsWith("en") && v.default) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      (voices.length > 0 ? voices[0] : null);

    const utterance = new SpeechSynthesisUtterance(plain);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = 1.05;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    // Chrome pause workaround: periodically pause/resume to prevent 15s cutoff
    const workaround = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);

    utterance.onend = () => {
      clearInterval(workaround);
      resolve();
    };
    utterance.onerror = () => {
      clearInterval(workaround);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/* ── Voice side panel ───────────────────────────────────────────────────── */

function VoiceSidePanel({
  listening,
  speaking,
  transcript,
  error,
  onStop,
}: {
  listening: boolean;
  speaking: boolean;
  transcript: string;
  error: string | null;
  onStop: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-800/30 lg:w-56 lg:flex-col lg:justify-center lg:gap-4 lg:border-l lg:border-t-0 lg:py-4">
      <div className="relative shrink-0">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 lg:h-20 lg:w-20 ${
            speaking
              ? "bg-brand/20 ring-4 ring-brand/30 dark:bg-brand/30"
              : listening
                ? "bg-brand/10 animate-pulse ring-4 ring-brand/20 dark:bg-brand/20"
                : "bg-slate-200 dark:bg-slate-700"
          }`}
        >
          {speaking ? (
            <svg className="h-6 w-6 lg:h-9 lg:w-9 text-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
              <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.06 4.5 4.5 0 000-6.366.75.75 0 010-1.06z" />
            </svg>
          ) : (
            <MicIcon className={`h-6 w-6 lg:h-9 lg:w-9 ${listening ? "text-brand" : "text-slate-400 dark:text-slate-500"}`} />
          )}
        </div>
        {listening && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 lg:h-3.5 lg:w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-full w-full rounded-full bg-red-500" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 lg:w-full lg:space-y-1.5 lg:text-center">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {speaking ? "Speaking…" : listening ? "Listening…" : "Ready"}
        </p>
        {transcript && (
          <p className="truncate rounded-lg bg-slate-100 px-3 py-1 text-xs italic text-slate-600 lg:py-1.5 dark:bg-slate-800 dark:text-slate-300">
            {transcript}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <p className="hidden text-[11px] text-slate-400 lg:block dark:text-slate-500">
          {speaking ? "AI is responding" : "Speak your question"}
        </p>
      </div>

      <button
        type="button"
        onClick={onStop}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-red-600"
      >
        <MicOffIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">End voice</span>
        <span className="sm:hidden">Stop</span>
      </button>
    </div>
  );
}

/* ── Quiz types ────────────────────────────────────────────────────────── */

type QuizQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
};

/* ── Inline quiz card ──────────────────────────────────────────────────── */

function ChatQuizCard({
  questions,
  programId,
  onSubmitted,
}: {
  questions: QuizQuestion[];
  programId: string;
  onSubmitted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((q) => answers[q.id]);

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/onboarding/programs/${programId}/complete-step`, { answers });
      setSubmitted(true);
      onSubmitted();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not submit answers.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="ml-10 mt-3 rounded-xl border border-green-200/80 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800/50 dark:bg-green-950/40 dark:text-green-300">
        Answers submitted! Moving to the next step...
      </div>
    );
  }

  return (
    <div className="ml-10 mt-3 space-y-4 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => {
              const selected = answers[q.id] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                  className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition ${
                    selected
                      ? "border-brand bg-brand/10 text-brand dark:border-brand dark:bg-brand/20 dark:text-brand"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand/30 hover:bg-brand/5 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:border-brand/40"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!allAnswered || submitting}
        onClick={() => void handleSubmit()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting..." : "Submit answers"}
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

const MOVE_ON_PATTERN = /ready to move on|move onto the next step/i;
const AFFIRMATIVE_PATTERN = /^(yes|yeah|yep|yup|sure|ok|okay|ready|let'?s go|go ahead|next|absolutely|definitely|of course)\b/i;

type Props = {
  stepTitle?: string;
  programTitle?: string;
  programId?: string;
  /** Called when the user confirms they're ready to move to the next step. */
  onCompleteStep?: () => void;
  /** If true, the current step can be completed (i.e. not already completed / not a quiz). */
  canComplete?: boolean;
  /** Current step kind — used to render inline quiz for quiz steps. */
  stepKind?: "LESSON" | "QUIZ" | "SUMMARY";
  /** Quiz questions to render inline for QUIZ steps. */
  quizQuestions?: QuizQuestion[];
  /** Called after the quiz is successfully submitted (to reload the player). */
  onQuizSubmitted?: () => void;
  /** Whether the programme has been completed. */
  programmeCompleted?: boolean;
  /** 1-based current step number. */
  stepNumber?: number;
  /** Total number of steps in the programme. */
  totalSteps?: number;
};

export function OnboardingChat({ stepTitle, programTitle, programId, onCompleteStep, canComplete, stepKind, quizQuestions, onQuizSubmitted, programmeCompleted, stepNumber, totalSteps }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voiceRef = useRef<ReturnType<typeof useVoiceMode> | null>(null);
  const speakingRef = useRef(false);

  const stepBoundaryRef = useRef(0);
  const sendTextRef = useRef<(text: string) => Promise<string | undefined>>(null);
  const stepTransitionRef = useRef(false);

  const prevStepRef = useRef(stepTitle);
  const prevStepKindRef = useRef(stepKind);
  const prevCompletedRef = useRef(programmeCompleted);
  const prevStepNumberRef = useRef(stepNumber);
  const shouldAutoSendRef = useRef(false);

  useEffect(() => {
    const justCompleted = programmeCompleted && !prevCompletedRef.current;
    prevCompletedRef.current = programmeCompleted;

    if (justCompleted) {
      voiceRef.current?.stop();
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        return [
          ...prev,
          {
            id: genId(),
            role: "assistant",
            content: "Programme complete",
            divider: true,
          },
          {
            id: genId(),
            role: "assistant",
            content: programTitle ?? "",
            celebration: true,
          },
        ];
      });
      return;
    }

    if (prevStepRef.current !== stepTitle) {
      const wentBack =
        stepNumber !== undefined &&
        prevStepNumberRef.current !== undefined &&
        stepNumber < prevStepNumberRef.current;

      prevStepRef.current = stepTitle;
      prevStepKindRef.current = stepKind;
      prevStepNumberRef.current = stepNumber;
      stepTransitionRef.current = true;

      let hadChat = false;
      const reachedSummary = stepKind === "SUMMARY";

      setMessages((prev) => {
        hadChat = prev.length > 0;
        stepBoundaryRef.current = prev.length;

        if (prev.length === 0) return prev;

        const label = reachedSummary
          ? "Programme complete"
          : (stepTitle ?? "Next step");
        const divider: Message = {
          id: genId(),
          role: "assistant",
          content: label,
          divider: true,
        };
        stepBoundaryRef.current = prev.length + 1;
        return [...prev, divider];
      });
      setInput("");
      setLoading(false);

      // Never auto-send when the user navigated backward — let them initiate.
      const shouldAuto =
        !wentBack &&
        (hadChat || shouldAutoSendRef.current) &&
        (!!stepTitle || reachedSummary);
      shouldAutoSendRef.current = false;

      if (shouldAuto && reachedSummary) {
        voiceRef.current?.stop();
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: "assistant",
              content: programTitle ?? "",
              celebration: true,
            },
          ]);
          stepTransitionRef.current = false;
        }, 100);
      } else if (shouldAuto) {
        if (stepKind === "QUIZ") {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: genId(),
                role: "assistant",
                content: `Time for a quiz: **${stepTitle}**. Select your answers below and submit when you're ready.`,
              },
            ]);
            stepTransitionRef.current = false;
          }, 100);
        } else {
          setTimeout(() => {
            stepTransitionRef.current = false;
            void sendTextRef.current?.(`Tell me about "${stepTitle}"`);
          }, 400);
        }
      } else {
        setTimeout(() => { stepTransitionRef.current = false; }, 50);
      }
    } else if (prevStepKindRef.current !== stepKind) {
      prevStepKindRef.current = stepKind;
      prevStepNumberRef.current = stepNumber;
    }
  }, [stepTitle, stepKind, programmeCompleted, programTitle, stepNumber]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (canComplete && onCompleteStep && AFFIRMATIVE_PATTERN.test(trimmed)) {
        const currentStepMsgs = messages.slice(stepBoundaryRef.current);
        const prevAssistant = currentStepMsgs.filter((m) => m.role === "assistant" && !m.divider).slice(-1)[0];
        if (prevAssistant && MOVE_ON_PATTERN.test(prevAssistant.content)) {
          const userMsg: Message = { id: genId(), role: "user", content: trimmed };
          setMessages((prev) => [...prev, userMsg]);
          setInput("");
          shouldAutoSendRef.current = true;
          onCompleteStep();
          return;
        }
      }

      const userMsg: Message = { id: genId(), role: "user", content: trimmed };
      const currentStepMessages = messages.slice(stepBoundaryRef.current);
      const history = currentStepMessages.filter((m) => !m.divider).slice(-20).map(({ role, content }) => ({ role, content }));
      const assistantId = genId();
      const isVoice = !!voiceRef.current?.active;

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 125_000);
      let bubbleInserted = false;
      let fullReply = "";

      try {
        const token = tokenStore.get();
        const res = await fetch(`${baseURL}/api/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            history,
            ...(programId ? { programId } : {}),
            ...(stepKind ? { stepKind } : {}),
            ...(stepTitle ? { stepTitle } : {}),
            ...(stepNumber != null ? { stepNumber } : {}),
            ...(totalSteps != null ? { totalSteps } : {}),
          }),
          signal: abortCtrl.signal,
        });

        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Server error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const data = line.startsWith("data: ") ? line.slice(6).trim() : "";
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { token?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.token) {
                fullReply += parsed.token;
                if (!bubbleInserted) {
                  bubbleInserted = true;
                  setLoading(false);
                  setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: "assistant", content: parsed.token! },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + parsed.token } : m,
                    ),
                  );
                }
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const msg = isAbort
          ? "The AI took too long to respond. Please try again."
          : (err instanceof Error ? err.message : "Something went wrong. Please try again.");
        setMessages((prev) => {
          if (bubbleInserted) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: msg, error: true } : m,
            );
          }
          return [...prev, { id: assistantId, role: "assistant", content: msg, error: true }];
        });
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }

      // Speak the full reply aloud when in voice mode
      if (isVoice && fullReply && voiceRef.current?.active) {
        speakingRef.current = true;
        voiceRef.current.stopRecognitionForSpeech();
        await speakText(fullReply);
        speakingRef.current = false;
        if (voiceRef.current?.active) {
          voiceRef.current.resumeListening();
        }
      }

      return fullReply;
    },
    [loading, messages, programId, canComplete, onCompleteStep, stepKind, stepTitle, stepNumber, totalSteps],
  );

  sendTextRef.current = sendText;

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      void sendText(text);
    },
    [sendText],
  );

  const voice = useVoiceMode(handleVoiceTranscript);
  voiceRef.current = voice;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!voice.active) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [voice.active]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    voice.stop();
  };

  const contextLabel = stepTitle
    ? `about "${stepTitle}"`
    : programTitle
      ? `about ${programTitle}`
      : "about your onboarding";

  return (
    <div className="flex h-full flex-col">
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20">
            <BotIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              AI Learning Assistant
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chat or speak {contextLabel}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Main area: messages + optional voice side panel */}
      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        {/* Chat column — always visible */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20">
                  <BotIcon className="h-8 w-8" />
                </span>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    Learn through conversation
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Ask questions {contextLabel}, or use voice mode.
                  </p>
                </div>
                <div className="mt-2 flex w-full max-w-sm flex-col gap-1.5">
                  {[
                    stepTitle ? `Explain "${stepTitle}" to me` : "What does this programme cover?",
                    "What should I know for this step?",
                    "Quiz me on this material",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-brand/30 hover:bg-brand/5 hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand/40 dark:hover:text-brand"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, idx) => {
                if (msg.divider) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-3 py-2">
                      <div className="h-px w-12 bg-slate-200 dark:bg-slate-700" />
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                        </svg>
                        Now on: {msg.content}
                      </span>
                      <div className="h-px w-12 bg-slate-200 dark:bg-slate-700" />
                    </div>
                  );
                }

                const boundary = stepBoundaryRef.current;
                const isAfterBoundary = idx >= boundary;
                const lastCurrentAssistantIdx = messages.reduce(
                  (last, m, i) => (i >= boundary && m.role === "assistant" && !m.divider ? i : last), -1,
                );
                const showQuiz =
                  msg.role === "assistant" &&
                  idx === lastCurrentAssistantIdx &&
                  isAfterBoundary &&
                  stepKind === "QUIZ" &&
                  quizQuestions && quizQuestions.length > 0 &&
                  programId && onQuizSubmitted &&
                  !loading && !stepTransitionRef.current;

                return msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content} />
                ) : msg.celebration ? (
                  <CelebrationCard key={msg.id} programTitle={msg.content || undefined} />
                ) : (
                  <div key={msg.id}>
                    <AssistantBubble content={msg.content} error={msg.error} />
                    {showQuiz && (
                      <ChatQuizCard
                        questions={quizQuestions}
                        programId={programId}
                        onSubmitted={onQuizSubmitted}
                      />
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="flex items-start gap-2">
                  <RobotAvatar />
                  <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-700">
                    <SpinnerDots />
                  </div>
                </div>
              )}
            </div>
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-200/80 p-3 dark:border-slate-700/80">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20 dark:border-slate-700 dark:bg-slate-800">
              <textarea
                ref={inputRef}
                className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="Ask about your onboarding…"
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || voice.active}
                aria-label="Message"
              />
              <button
                type="button"
                onClick={() => void sendText(input)}
                disabled={!input.trim() || loading || voice.active}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!voice.supported) {
                    alert(
                      "Voice mode requires a browser that supports the Web Speech API (Chrome, Edge, or Safari). Firefox does not support it by default.",
                    );
                    return;
                  }
                  if (voice.active) {
                    voice.stop();
                  } else {
                    voice.start();
                  }
                }}
                disabled={loading}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                  voice.active
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-slate-200 text-slate-600 hover:bg-brand/10 hover:text-brand dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-brand/20 dark:hover:text-brand"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                aria-label={voice.active ? "End voice mode" : "Start voice mode"}
                title={voice.active ? "End voice mode" : "Voice mode"}
              >
                {voice.active ? <MicOffIcon className="h-4 w-4" /> : <MicIcon />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-600">
              AI can make mistakes · Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Voice side panel — shown alongside chat when voice mode is active */}
        {voice.active && (
          <VoiceSidePanel
            listening={voice.listening}
            speaking={speakingRef.current || voice.speaking}
            transcript={voice.transcript}
            error={voice.error}
            onStop={voice.stop}
          />
        )}
      </div>
    </div>
  );
}
