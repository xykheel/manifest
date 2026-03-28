import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
};

type ApiError = {
  response?: { data?: { error?: string } };
  message?: string;
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

function ExpandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 13.75v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 13h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM13.28 12.22l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 10-1.06 1.06zM7.78 6.72L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V4.56l3.22 3.22a.75.75 0 001.06-1.06z" />
    </svg>
  );
}

function CollapseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.22 3.22a.75.75 0 011.06 0l.97.97V1.75a.75.75 0 011.5 0v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 010-1.5h2.44l-.97-.97a.75.75 0 010-1.06zM3.22 9.22a.75.75 0 010 1.06l-.97.97H4.69a.75.75 0 010 1.5H.19a.75.75 0 01-.75-.75v-4.5a.75.75 0 011.5 0v2.44l.97-.97a.75.75 0 011.31.25zM10.78 16.78a.75.75 0 01-1.06 0l-.97-.97v2.44a.75.75 0 01-1.5 0v-4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H10.06l.72.72a.75.75 0 010 1.06zM16.78 10.78a.75.75 0 010-1.06l.97-.97H15.31a.75.75 0 010-1.5h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-2.44l-.97.97a.75.75 0 01-1.06 0z" />
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

/** Markdown components wired to Tailwind classes matching the bubble's text style */
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

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: genId(), role: "user", content: text };
    const history = messages.slice(-20).map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post<{ reply: string }>(
        "/api/chat",
        { message: text, history },
        { timeout: 125_000 },
      );
      const assistantMsg: Message = { id: genId(), role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg =
        apiErr?.response?.data?.error ??
        (apiErr?.message?.toLowerCase().includes("timeout")
          ? "The AI took too long to respond. Please try again."
          : "Something went wrong. Please try again.");
      const errMsg: Message = { id: genId(), role: "assistant", content: msg, error: true };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Floating toggle button */}
      <div className="fixed bottom-5 right-5 z-[200]">
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-2 ring-brand/20 transition hover:scale-105 hover:bg-brand/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            aria-label="Open AI assistant"
          >
            <BotIcon className="h-7 w-7" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-brand/70 ring-2 ring-white dark:ring-slate-900" />
            </span>
          </button>
        )}
      </div>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className={`animate-ui-fade-in fixed bottom-5 right-5 z-[200] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5 transition-[width,height] duration-300 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10 ${
            expanded
              ? "w-[min(calc(100vw-2.5rem),60rem)]"
              : "w-[min(calc(100vw-2.5rem),22rem)]"
          }`}
          style={{
            height: expanded
              ? "min(88dvh, 960px)"
              : "min(580px, calc(100dvh - 5rem))",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="AI onboarding assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20">
                <BotIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Onboarding Assistant
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Powered by AI
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label={expanded ? "Shrink chat" : "Expand chat"}
                title={expanded ? "Shrink chat" : "Expand chat"}
              >
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Close assistant"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20">
                  <BotIcon className="h-8 w-8" />
                </span>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    Hi, I'm your onboarding assistant!
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Ask me anything about your onboarding programmes.
                  </p>
                </div>
                <div className="mt-2 flex w-full flex-col gap-1.5">
                  {[
                    "What programmes are available?",
                    "What does my onboarding cover?",
                    "How long does onboarding take?",
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
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content} />
                ) : (
                  <AssistantBubble key={msg.id} content={msg.content} error={msg.error} />
                ),
              )}
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

          {/* Input */}
          <div className="border-t border-slate-200/80 bg-white/80 p-3 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20 dark:border-slate-700 dark:bg-slate-800">
              <textarea
                ref={inputRef}
                className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="Ask about your onboarding…"
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                aria-label="Message"
              />
              <button
                type="button"
                onClick={() => { void sendMessage(); }}
                disabled={!input.trim() || loading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-600">
              AI can make mistakes · Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
