import { decrypt } from "./encryption";

export type AiProvider = "OLLAMA" | "OPENAI" | "ANTHROPIC" | "OPENAI_COMPATIBLE";

export type AiSettingsShape = {
  provider: AiProvider;
  baseUrl: string;
  encryptedApiKey: string;
  selectedModel: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const MODELS_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 120_000;

/**
 * Anthropic does not expose a simple unauthenticated model list; we maintain a
 * curated list of current chat-capable models instead.
 */
const ANTHROPIC_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// listModels
// ---------------------------------------------------------------------------

export async function listModels(settings: AiSettingsShape): Promise<string[]> {
  const apiKey = decrypt(settings.encryptedApiKey);
  const baseUrl = stripTrailingSlash(settings.baseUrl);

  switch (settings.provider) {
    case "OLLAMA": {
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetchWithTimeout(`${baseUrl}/api/tags`, { headers }, MODELS_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);

      const body = (await res.json()) as { models?: { name: string }[] };
      return (body.models ?? []).map((m) => m.name);
    }

    case "OPENAI":
    case "OPENAI_COMPATIBLE": {
      const url = `${stripTrailingSlash(baseUrl || "https://api.openai.com")}/v1/models`;
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetchWithTimeout(url, { headers }, MODELS_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Provider responded with ${res.status}`);

      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => m.id).sort();
    }

    case "ANTHROPIC":
      return ANTHROPIC_MODELS;

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------

export async function chat(
  settings: AiSettingsShape,
  messages: ChatMessage[],
): Promise<string> {
  const apiKey = decrypt(settings.encryptedApiKey);
  const model = settings.selectedModel;

  switch (settings.provider) {
    case "OLLAMA": {
      const baseUrl = stripTrailingSlash(settings.baseUrl);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetchWithTimeout(
        `${baseUrl}/api/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ model, messages, stream: false }),
        },
        CHAT_TIMEOUT_MS,
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama error (${res.status}): ${text || "unknown"}`);
      }

      const body = (await res.json()) as {
        message?: { content?: string };
        error?: string;
      };
      if (body.error) throw new Error(body.error);
      return body.message?.content ?? "";
    }

    case "OPENAI":
    case "OPENAI_COMPATIBLE": {
      const baseUrl = stripTrailingSlash(settings.baseUrl || "https://api.openai.com");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ model, messages }),
        },
        CHAT_TIMEOUT_MS,
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Provider error (${res.status}): ${text || "unknown"}`);
      }

      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      if (body.error?.message) throw new Error(body.error.message);
      return body.choices?.[0]?.message?.content ?? "";
    }

    case "ANTHROPIC": {
      const baseUrl = stripTrailingSlash(settings.baseUrl || "https://api.anthropic.com");

      // Anthropic separates the system prompt from the conversation messages
      const systemMsg = messages.find((m) => m.role === "system");
      const convoMessages = messages.filter((m) => m.role !== "system");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      };

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            ...(systemMsg ? { system: systemMsg.content } : {}),
            messages: convoMessages,
          }),
        },
        CHAT_TIMEOUT_MS,
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic error (${res.status}): ${text || "unknown"}`);
      }

      const body = (await res.json()) as {
        content?: { type: string; text: string }[];
        error?: { message?: string };
      };
      if (body.error?.message) throw new Error(body.error.message);
      return body.content?.find((c) => c.type === "text")?.text ?? "";
    }

    default:
      throw new Error(`Unsupported AI provider: ${String(settings.provider)}`);
  }
}
