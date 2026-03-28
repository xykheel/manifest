import { Router } from "express";
import { z } from "zod";
import { type AiProvider, listModels } from "../../lib/aiProviders";
import { encrypt } from "../../lib/encryption";
import { prisma } from "../../lib/prisma";

export const adminAiSettingsRouter = Router();

const SETTINGS_ID = "singleton";

const AI_PROVIDERS = ["OLLAMA", "OPENAI", "ANTHROPIC", "OPENAI_COMPATIBLE"] as const;

/**
 * GET /api/admin/settings/ai
 *
 * Returns current configuration. The API key is NEVER returned — only a boolean
 * indicating whether one is stored.
 */
adminAiSettingsRouter.get("/settings/ai", async (_req, res) => {
  const settings = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID } });
  res.json({
    provider: (settings?.provider ?? "OLLAMA") as AiProvider,
    baseUrl: settings?.baseUrl ?? "",
    hasApiKey: Boolean(settings?.encryptedApiKey),
    selectedModel: settings?.selectedModel ?? "",
  });
});

const updateSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  baseUrl: z.string().optional().default(""),
  /**
   * apiKey behaviour:
   *   undefined / omitted — keep the existing key unchanged
   *   ""                  — explicitly clear the key
   *   any other string    — encrypt and store the new key
   */
  apiKey: z.string().optional(),
  selectedModel: z.string().optional().default(""),
});

/**
 * PUT /api/admin/settings/ai
 *
 * Accepts an optional `apiKey`. When omitted the stored key is preserved, allowing
 * admins to update URL or model without re-entering their key. An empty string
 * explicitly clears the key.
 */
adminAiSettingsRouter.put("/settings/ai", async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID } });

  let encryptedApiKey: string;
  if (parsed.data.apiKey === undefined) {
    encryptedApiKey = existing?.encryptedApiKey ?? "";
  } else if (parsed.data.apiKey === "") {
    encryptedApiKey = "";
  } else {
    encryptedApiKey = encrypt(parsed.data.apiKey);
  }

  const settings = await prisma.aiSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      provider: parsed.data.provider,
      baseUrl: parsed.data.baseUrl,
      encryptedApiKey,
      selectedModel: parsed.data.selectedModel,
    },
    update: {
      provider: parsed.data.provider,
      baseUrl: parsed.data.baseUrl,
      encryptedApiKey,
      selectedModel: parsed.data.selectedModel,
    },
  });

  res.json({
    provider: settings.provider as AiProvider,
    baseUrl: settings.baseUrl,
    hasApiKey: Boolean(settings.encryptedApiKey),
    selectedModel: settings.selectedModel,
  });
});

/**
 * GET /api/admin/settings/ai/models
 *
 * Fetches available models from the configured provider. For Anthropic this
 * returns a curated static list; all others proxy to the provider's API.
 */
adminAiSettingsRouter.get("/settings/ai/models", async (_req, res) => {
  const settings = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID } });

  if (!settings) {
    res.status(400).json({ error: "AI settings are not configured." });
    return;
  }

  const needsBaseUrl =
    settings.provider === "OLLAMA" || settings.provider === "OPENAI_COMPATIBLE";

  if (needsBaseUrl && !settings.baseUrl) {
    res.status(400).json({ error: "A server URL is required for this provider." });
    return;
  }

  try {
    const models = await listModels({
      provider: settings.provider as AiProvider,
      baseUrl: settings.baseUrl,
      encryptedApiKey: settings.encryptedApiKey,
      selectedModel: settings.selectedModel,
    });
    res.json({ models });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const msg = err instanceof Error ? err.message : "Could not fetch models.";
    res.status(502).json({
      error: isAbort ? "Request to the AI provider timed out." : msg,
    });
  }
});
