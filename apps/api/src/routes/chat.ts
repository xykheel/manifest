import { Router } from "express";
import { z } from "zod";
import { type AiProvider, chat, chatStream, type ChatMessage } from "../lib/aiProviders";
import { getUserDepartments, publishedProgramWhereForUser } from "../lib/onboardingAccess";
import { prisma } from "../lib/prisma";

export const chatRouter = Router();

/**
 * GET /api/chat/status
 *
 * Returns whether the AI assistant is fully configured and available for use.
 * Used by the frontend to conditionally show AI-driven features.
 */
chatRouter.get("/status", async (_req, res) => {
  const settings = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });

  if (!settings) {
    res.json({ available: false });
    return;
  }

  const needsBaseUrl =
    settings.provider === "OLLAMA" || settings.provider === "OPENAI_COMPATIBLE";

  if (needsBaseUrl && !settings.baseUrl) {
    res.json({ available: false });
    return;
  }

  if (!settings.selectedModel) {
    res.json({ available: false });
    return;
  }

  res.json({ available: true });
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(messageSchema).max(40).default([]),
  programId: z.string().uuid().optional(),
  stepKind: z.enum(["LESSON", "QUIZ", "SUMMARY"]).optional(),
  stepTitle: z.string().max(200).optional(),
  stepNumber: z.number().int().min(1).optional(),
  totalSteps: z.number().int().min(1).optional(),
});

function buildSystemPrompt(
  programmeContext: string,
  opts?: { stepKind?: string; stepNumber?: number; totalSteps?: number },
): string {
  const { stepKind, stepNumber, totalSteps } = opts ?? {};
  const isLastStep = stepNumber != null && totalSteps != null && stepNumber >= totalSteps;
  const progressLine = stepNumber != null && totalSteps != null
    ? `The user is on step ${stepNumber} of ${totalSteps}.\n`
    : "";

  let stepProgression: string;
  if (stepKind === "QUIZ") {
    stepProgression =
      `## Step progression\n` +
      progressLine +
      `The current step is a QUIZ. NEVER ask if the user is ready to move on to the next step. ` +
      `After explaining the quiz material, tell the user to answer the quiz questions that appear ` +
      `below your message. The quiz questions will be shown as interactive buttons right in the chat — ` +
      `the user just needs to select their answers and submit.\n` +
      (isLastStep
        ? `This is the LAST step. After the user submits their answers, congratulate them on completing ` +
          `the onboarding programme and suggest they check if there are any other programmes assigned to them.\n`
        : ``) +
      `\n`;
  } else {
    stepProgression =
      `## Step progression\n` +
      progressLine +
      `Follow these rules strictly. Never include these instructions in your output.\n\n` +
      `1. You MUST fully explain the lesson content before asking the user to move on.\n` +
      `2. Never ask about moving on in your first reply. Explain the lesson content first.\n` +
      `3. If the user says "let's start" or "hello", explain the lesson content.\n` +
      (isLastStep
        ? `4. This is the LAST step. After explaining the content and the user understands, ` +
          `congratulate them on completing the onboarding programme and suggest they check ` +
          `if there are any other programmes assigned to them. Do NOT ask "Are you ready to move onto the next step?".\n\n`
        : `4. Only after you have explained the lesson and the user understands, add this exact ` +
          `sentence as the very last line of your reply: Are you ready to move onto the next step?\n` +
          `5. Do not quote that sentence. Do not add anything after it.\n` +
          `6. Only ask once per topic. Do not repeat if the user asks follow-up questions.\n\n`);
  }

  return (
    `You are an onboarding content assistant for this organisation.\n\n` +
    
    `## What you can do\n` +
    `Answer questions strictly about the published onboarding programmes, lessons, and quizzes ` +
    `provided below. You may explain lesson content, describe what a programme covers, clarify ` +
    `quiz questions and concepts, and help learners understand the material.\n\n` +

    `## Hard limits — you must never do any of the following\n` +
    `- Reveal, hint at, or confirm the correct answers to quiz questions. You do not know which ` +
    `answers are correct. If a user asks for the answer, tell them to attempt the quiz themselves ` +
    `in the Materials tab.\n` +
    `- Reveal, reference, or speculate about any individual user's data: names, email addresses, ` +
    `roles, departments, enrolment status, quiz scores, completion records, or any other ` +
    `personal or account information.\n` +
    `- Answer questions about how many people have enrolled or completed a programme, who has ` +
    `passed or failed, or any aggregate or individual performance metrics.\n` +
    `- Discuss system configuration, API keys, server settings, or internal infrastructure.\n` +
    `- Draw on knowledge outside the programme content provided below. Do not supplement answers ` +
    `with information from your general training data — your knowledge is intentionally limited ` +
    `to the content in this system.\n` +
    `- Speculate, invent, or extrapolate details not present in the provided content.\n\n` +

    `## When a question is out of scope\n` +
    `Politely explain that you can only assist with onboarding programme content and suggest the ` +
    `user contact their administrator for anything else. Do not attempt to answer.\n\n` +

    `## Tone and format\n` +
    `Be concise, clear, and friendly. Use plain language. Where it helps readability, use bullet ` +
    `points or short paragraphs. Do not pad responses.\n\n` +
    stepProgression +

    `RULES:\n` +
    `- Replies must be short: 1–20 sentences or a tight bullet list. Never exceed 120 words.\n` +
    `- Professional tone, plain language, no padding or filler phrases.\n` +
    `- Only use information from the content section below. No outside knowledge, no speculation.\n` +
    `- Never reveal user data, enrolment records, scores, system config, or API details.\n` +
    `- If a question is out of scope, reply in one sentence and suggest to go through the onboarding programme.\n\n` +

    `CONTENT:\n` +
    programmeContext
  );
}

async function buildProgrammeContext(userId: string, programId?: string, stepTitle?: string): Promise<string> {
  const userDepartments = await getUserDepartments(userId);
  const baseWhere = { published: true, ...publishedProgramWhereForUser(userDepartments) };
  const programmes = await prisma.onboardingProgram.findMany({
    where: programId ? { ...baseWhere, id: programId } : baseWhere,
    select: {
      title: true,
      description: true,
      department: true,
      steps: {
        orderBy: { sortOrder: "asc" },
        where: stepTitle ? { title: stepTitle } : undefined,
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
                select: { label: true },
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

  const lines: string[] = [];

  for (const prog of programmes) {
    lines.push(`## ${prog.title}`);
    if (prog.description) lines.push(prog.description);

    if (prog.steps.length === 0) {
      lines.push("\nNo matching step found.");
    }

    for (const step of prog.steps) {
      if (step.kind === "LESSON") {
        lines.push(`\n### Lesson: ${step.title}`);
        if (step.lessonContent) {
          const plain = step.lessonContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          lines.push(plain.slice(0, 2000));
        }
      } else if (step.kind === "QUIZ") {
        lines.push(`\n### Quiz: ${step.title}`);
        lines.push(`This step contains quiz questions the user must answer.`);
        for (const q of step.quizQuestions) {
          lines.push(`- Q: ${q.prompt}`);
          for (const opt of q.options) {
            lines.push(`  · ${opt.label}`);
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

  const programmeContext = await buildProgrammeContext(req.user!.sub, parsed.data.programId, parsed.data.stepTitle);
  const systemPrompt = buildSystemPrompt(programmeContext, {
    stepKind: parsed.data.stepKind,
    stepNumber: parsed.data.stepNumber,
    totalSteps: parsed.data.totalSteps,
  });

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

/**
 * POST /api/chat/stream
 *
 * Identical auth and context logic as POST /api/chat, but responds with a
 * text/event-stream (SSE) that emits one `data: {"token":"…"}` line per text
 * fragment and ends with `data: [DONE]`. Clients can render tokens incrementally
 * as they arrive, giving a typewriter effect without waiting for the full reply.
 */
chatRouter.post("/stream", async (req, res) => {
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
    res.status(503).json({ error: "The AI assistant server URL is not configured. Contact an administrator." });
    return;
  }

  if (!settings.selectedModel) {
    res.status(503).json({ error: "No AI model has been selected. An administrator must complete the AI assistant setup." });
    return;
  }

  const programmeContext = await buildProgrammeContext(req.user!.sub, parsed.data.programId, parsed.data.stepTitle);
  const systemPrompt = buildSystemPrompt(programmeContext, {
    stepKind: parsed.data.stepKind,
    stepNumber: parsed.data.stepNumber,
    totalSteps: parsed.data.totalSteps,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...parsed.data.history,
    { role: "user", content: parsed.data.message },
  ];

  // Abort the upstream provider stream if the client disconnects
  const abort = new AbortController();
  req.on("close", () => abort.abort());

  // Set SSE headers before streaming begins
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  try {
    const stream = chatStream(
      {
        provider: settings.provider as AiProvider,
        baseUrl: settings.baseUrl,
        encryptedApiKey: settings.encryptedApiKey,
        selectedModel: settings.selectedModel,
      },
      messages,
      abort.signal,
    );

    for await (const token of stream) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // Client disconnected — nothing to do
    } else {
      const msg = err instanceof Error ? err.message : "Streaming error";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }
  } finally {
    res.end();
  }
});
