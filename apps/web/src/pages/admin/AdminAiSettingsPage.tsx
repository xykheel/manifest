import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type AiProvider = "OLLAMA" | "OPENAI" | "ANTHROPIC" | "OPENAI_COMPATIBLE";

type AiSettings = {
  provider: AiProvider;
  baseUrl: string;
  hasApiKey: boolean;
  selectedModel: string;
};

const PROVIDER_META: Record<
  AiProvider,
  { label: string; description: string; baseUrlLabel: string; baseUrlPlaceholder: string; baseUrlRequired: boolean; apiKeyLabel: string }
> = {
  OLLAMA: {
    label: "Ollama",
    description: "Self-hosted open-source models via Ollama.",
    baseUrlLabel: "Server URL",
    baseUrlPlaceholder: "http://localhost:11434",
    baseUrlRequired: true,
    apiKeyLabel: "API Key",
  },
  OPENAI: {
    label: "OpenAI",
    description: "GPT-4o, GPT-4 Turbo, and other OpenAI models.",
    baseUrlLabel: "Base URL override",
    baseUrlPlaceholder: "https://api.openai.com (optional)",
    baseUrlRequired: false,
    apiKeyLabel: "OpenAI API Key",
  },
  ANTHROPIC: {
    label: "Anthropic",
    description: "Claude 3.5, Claude 3 Opus, and other Anthropic models.",
    baseUrlLabel: "Base URL override",
    baseUrlPlaceholder: "https://api.anthropic.com (optional)",
    baseUrlRequired: false,
    apiKeyLabel: "Anthropic API Key",
  },
  OPENAI_COMPATIBLE: {
    label: "OpenAI-compatible",
    description: "Any server that implements the OpenAI chat completions API (Groq, Azure OpenAI, LM Studio, etc.).",
    baseUrlLabel: "Server URL",
    baseUrlPlaceholder: "https://api.groq.com/openai",
    baseUrlRequired: true,
    apiKeyLabel: "API Key",
  },
};

function SpinnerIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function AdminAiSettingsPage() {
  const [provider, setProvider] = useState<AiProvider>("OLLAMA");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<string[]>([]);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = PROVIDER_META[provider];

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const { data } = await api.get<AiSettings>("/api/admin/settings/ai");
      setProvider(data.provider ?? "OLLAMA");
      setBaseUrl(data.baseUrl ?? "");
      setHasApiKey(data.hasApiKey ?? false);
      setSelectedModel(data.selectedModel ?? "");
    } catch {
      setSettingsError("Could not load AI settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setModelsError(null);
    setModels([]);
    try {
      const { data } = await api.get<{ models: string[] }>("/api/admin/settings/ai/models");
      setModels(data.models);
      if (data.models.length > 0 && !data.models.includes(selectedModel)) {
        setSelectedModel(data.models[0]);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setModelsError(msg ?? "Could not fetch models from the provider.");
    } finally {
      setLoadingModels(false);
    }
  }, [selectedModel]);

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    setModels([]);
    setModelsError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const body: {
      provider: AiProvider;
      baseUrl: string;
      selectedModel: string;
      apiKey?: string;
    } = { provider, baseUrl, selectedModel };

    // Only send apiKey if the user typed something (blank = keep existing key)
    if (apiKeyInput !== "") {
      body.apiKey = apiKeyInput;
    }

    try {
      const { data } = await api.put<AiSettings>("/api/admin/settings/ai", body);
      setHasApiKey(data.hasApiKey);
      setApiKeyInput("");
      setSaveSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setSaveError(msg ?? "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <div>
          <Link
            to="/dashboard"
            className="text-sm text-slate-600 transition hover:text-brand dark:text-slate-300"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            AI Assistant Settings
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Configure the AI provider that powers the onboarding chatbot.
          </p>
        </div>

        {settingsError && (
          <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {settingsError}
          </p>
        )}

        {loadingSettings ? (
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <SpinnerIcon className="h-5 w-5" />
            Loading settings…
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSave(e); }} className="space-y-6">
            {/* Provider selection */}
            <div className="card-surface space-y-4 p-6">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                AI Provider
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(PROVIDER_META) as AiProvider[]).map((p) => {
                  const m = PROVIDER_META[p];
                  const active = provider === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={[
                        "rounded-2xl border p-4 text-left transition duration-150",
                        active
                          ? "border-brand/40 bg-brand/5 ring-1 ring-brand/30 dark:border-brand/50 dark:bg-brand/10 dark:ring-brand/40"
                          : "border-slate-200 hover:border-brand/25 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-brand/35 dark:hover:bg-slate-800/60",
                      ].join(" ")}
                    >
                      <p className={`text-sm font-semibold ${active ? "text-brand" : "text-slate-800 dark:text-slate-100"}`}>
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                        {m.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Connection details */}
            <div className="card-surface space-y-5 p-6">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Connection
              </h2>

              {/* Base URL */}
              {(meta.baseUrlRequired || provider === "OPENAI" || provider === "ANTHROPIC") && (
                <div>
                  <label
                    htmlFor="baseUrl"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    {meta.baseUrlLabel}
                    {!meta.baseUrlRequired && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                        (optional)
                      </span>
                    )}
                  </label>
                  <input
                    id="baseUrl"
                    type="url"
                    className="input mt-1.5 w-full"
                    placeholder={meta.baseUrlPlaceholder}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required={meta.baseUrlRequired}
                  />
                  {!meta.baseUrlRequired && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Leave blank to use the provider's default endpoint.
                    </p>
                  )}
                </div>
              )}

              {/* API key */}
              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  {meta.apiKeyLabel}
                  {provider === "OLLAMA" && (
                    <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                      (optional)
                    </span>
                  )}
                </label>

                <div className="mt-1.5 relative">
                  <input
                    id="apiKey"
                    type="password"
                    className="input w-full pr-24 font-mono"
                    placeholder={hasApiKey ? "Leave blank to keep saved key" : "Enter API key"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    autoComplete="new-password"
                  />
                  {hasApiKey && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Saved
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Keys are encrypted at rest and never sent to the browser.
                  </p>
                  {hasApiKey && (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                      onClick={() => {
                        setApiKeyInput("");
                        void api.put("/api/admin/settings/ai", {
                          provider,
                          baseUrl,
                          selectedModel,
                          apiKey: "",
                        }).then(() => setHasApiKey(false));
                      }}
                    >
                      Remove key
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Model selection */}
            <div className="card-surface space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Model
                </h2>
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                  disabled={loadingModels}
                  onClick={() => { void fetchModels(); }}
                >
                  {loadingModels ? (
                    <>
                      <SpinnerIcon />
                      Fetching…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                      {provider === "ANTHROPIC" ? "Load models" : "Refresh models"}
                    </>
                  )}
                </button>
              </div>

              {modelsError && (
                <p className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {modelsError}
                </p>
              )}

              {models.length > 0 ? (
                <div>
                  <label
                    htmlFor="selectedModel"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Active model
                  </label>
                  <select
                    id="selectedModel"
                    className="input mt-1.5 w-full"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    <option value="">— select a model —</option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedModel ? (
                    <>
                      Currently using{" "}
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                        {selectedModel}
                      </span>
                      . Click <strong>{provider === "ANTHROPIC" ? "Load models" : "Refresh models"}</strong> to update the list.
                    </>
                  ) : (
                    <>
                      Click <strong>{provider === "ANTHROPIC" ? "Load models" : "Refresh models"}</strong> to see available models.
                    </>
                  )}
                </p>
              )}
            </div>

            {saveError && (
              <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {saveError}
              </p>
            )}

            {saveSuccess && (
              <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                Settings saved successfully.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary inline-flex items-center gap-2"
                disabled={saving}
              >
                {saving && <SpinnerIcon />}
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
