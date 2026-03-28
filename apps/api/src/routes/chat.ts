import { Router } from "express";
import { z } from "zod";
import { type AiProvider, chat, type ChatMessage } from "../lib/aiProviders";
import { prisma } from "../lib/prisma";

export const chatRouter = Router();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(messageSchema).max(40).default([]),
});

async function buildProgrammeContext(): Promise<string> {
  const programmes = await prisma.onboardingProgram.findMany({
    where: { published: true },
    select: {
      title: true,
      description: true,
      department: true,
      steps: {
        orderBy: { sortOrder: "asc" },
        select: {
          kind: true,
          title: true,
          lessonContent: true,
          quizQuestions: {
            orderBy: { sortOrder: "asc" },
            select: {
              prompt: true,
              options: {
                orderBy: { sortOrder: "asc" },
                select: { label: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  if (programmes.length === 0) {
    return "No published onboarding programmes are currently available.";
  }

  const lines: string[] = ["Published onboarding programmes:\n"];

  for (const prog of programmes) {
    lines.push(`## ${prog.title} (Department: ${prog.department})`);
    if (prog.description) lines.push(prog.description);

    for (const step of prog.steps) {
      if (step.kind === "LESSON") {
        lines.push(`\n### Lesson: ${step.title}`);
        if (step.lessonContent) {
          const plain = step.lessonContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          lines.push(plain.slice(0, 1000));
        }
      } else if (step.kind === "QUIZ") {
        lines.push(`\n### Quiz: ${step.title}`);
        for (const q of step.quizQuestions) {
          lines.push(`- Q: ${q.prompt}`);
          for (const opt of q.options) {
            lines.push(`  ${opt.isCorrect ? "✓" : "·"} ${opt.label}`);
          }
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * POST /api/chat
 *
 * Authenticated endpoint (any role). Loads published programme context from the
 * database, builds a system prompt, and proxies the conversation to the
 * configured AI provider. The API key is decrypted server-side and never exposed
 * to the client.
 */
chatRouter.post("/", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const settings = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });

  if (!settings) {
    res.status(503).json({ error: "The AI assistant has not been configured yet." });
    return;
  }

  const needsBaseUrl =
    settings.provider === "OLLAMA" || settings.provider === "OPENAI_COMPATIBLE";

  if (needsBaseUrl && !settings.baseUrl) {
    res
      .status(503)
      .json({ error: "The AI assistant server URL is not configured. Contact an administrator." });
    return;
  }

  if (!settings.selectedModel) {
    res.status(503).json({
      error:
        "No AI model has been selected. An administrator must complete the AI assistant setup.",
    });
    return;
  }

  const programmeContext = await buildProgrammeContext();

  const systemPrompt =
    `You are a helpful onboarding assistant for this organisation. ` +
    `Your role is to answer questions about onboarding programmes, help learners understand what ` +
    `is expected of them, and guide them through the available content.\n\n` +
    `Be concise, friendly, and accurate. Only answer questions related to the onboarding ` +
    `programmes and content below. If a question is unrelated to onboarding, politely redirect ` +
    `the user.\n\n` +
    programmeContext;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...parsed.data.history,
    { role: "user", content: parsed.data.message },
  ];

  try {
    const reply = await chat(
      {
        provider: settings.provider as AiProvider,
        baseUrl: settings.baseUrl,
        encryptedApiKey: settings.encryptedApiKey,
        selectedModel: settings.selectedModel,
      },
      messages,
    );
    res.json({ reply });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const msg = err instanceof Error ? err.message : "Could not reach the AI server.";
    res.status(502).json({
      error: isAbort
        ? "The AI model took too long to respond (timeout after 2 minutes). Try a smaller model or a simpler question."
        : msg,
    });
  }
});
