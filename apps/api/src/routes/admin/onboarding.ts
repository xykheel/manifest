import { Department, OnboardingStepKind } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export const adminOnboardingRouter = Router();

const createProgramSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  published: z.boolean().optional(),
  department: z.nativeEnum(Department).optional(),
});

const patchProgramSchema = createProgramSchema.partial();

const quizQuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        isCorrect: z.boolean(),
      }),
    )
    .min(2),
});

function assertSingleCorrectPerQuestion(
  questions: z.infer<typeof quizQuestionSchema>[],
): void {
  for (const q of questions) {
    const n = q.options.filter((o) => o.isCorrect).length;
    if (n !== 1) {
      throw new Error("Each quiz question must have exactly one correct option");
    }
  }
}

const createLessonBody = z.object({
  kind: z.literal("LESSON"),
  title: z.string().min(1),
  lessonContent: z.string().min(1),
});

const createQuizBody = z.object({
  kind: z.literal("QUIZ"),
  title: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(1),
});

const createStepSchema = z.discriminatedUnion("kind", [createLessonBody, createQuizBody]);

const stepInclude = {
  quizQuestions: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      options: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

adminOnboardingRouter.get("/programs", async (_req, res) => {
  const programs = await prisma.onboardingProgram.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { steps: true, enrollments: true } },
    },
  });
  res.json({
    programs: programs.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      published: p.published,
      department: p.department,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      stepCount: p._count.steps,
      enrollmentCount: p._count.enrollments,
    })),
  });
});

adminOnboardingRouter.post("/programs", async (req, res) => {
  const parsed = createProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const program = await prisma.onboardingProgram.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      published: parsed.data.published ?? false,
      department: parsed.data.department ?? Department.OTHER,
    },
  });
  res.status(201).json({ program });
});

adminOnboardingRouter.get("/programs/:programId", async (req, res) => {
  const program = await prisma.onboardingProgram.findUnique({
    where: { id: req.params.programId },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
        include: stepInclude,
      },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }
  res.json({ program });
});

adminOnboardingRouter.patch("/programs/:programId", async (req, res) => {
  const parsed = patchProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const data = parsed.data;
  try {
    const program = await prisma.onboardingProgram.update({
      where: { id: req.params.programId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.department !== undefined && { department: data.department }),
      },
    });
    res.json({ program });
  } catch {
    res.status(404).json({ error: "Programme not found" });
  }
});

adminOnboardingRouter.delete("/programs/:programId", async (req, res) => {
  try {
    await prisma.onboardingProgram.delete({ where: { id: req.params.programId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Programme not found" });
  }
});

async function nextSortOrder(programId: string): Promise<number> {
  const agg = await prisma.onboardingStep.aggregate({
    where: { programId },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

async function renumberSteps(programId: string): Promise<void> {
  const steps = await prisma.onboardingStep.findMany({
    where: { programId },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.$transaction(
    steps.map((s, i) =>
      prisma.onboardingStep.update({ where: { id: s.id }, data: { sortOrder: i } }),
    ),
  );
}

adminOnboardingRouter.post("/programs/:programId/steps", async (req, res) => {
  const parsed = createStepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid step payload", details: parsed.error.flatten() });
    return;
  }
  const programId = req.params.programId;
  const program = await prisma.onboardingProgram.findUnique({ where: { id: programId } });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }
  const body = parsed.data;
  const sortOrder = await nextSortOrder(programId);
  try {
    if (body.kind === "LESSON") {
      const step = await prisma.onboardingStep.create({
        data: {
          programId,
          sortOrder,
          kind: OnboardingStepKind.LESSON,
          title: body.title,
          lessonContent: body.lessonContent,
        },
        include: stepInclude,
      });
      res.status(201).json({ step });
      return;
    }
    assertSingleCorrectPerQuestion(body.questions);
    const step = await prisma.onboardingStep.create({
      data: {
        programId,
        sortOrder,
        kind: OnboardingStepKind.QUIZ,
        title: body.title,
        quizQuestions: {
          create: body.questions.map((q, qi) => ({
            sortOrder: qi,
            prompt: q.prompt,
            options: {
              create: q.options.map((o, oi) => ({
                sortOrder: oi,
                label: o.label,
                isCorrect: o.isCorrect,
              })),
            },
          })),
        },
      },
      include: stepInclude,
    });
    res.status(201).json({ step });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create step";
    res.status(400).json({ error: msg });
  }
});

const patchLessonSchema = z.object({
  title: z.string().min(1).optional(),
  lessonContent: z.string().min(1).optional(),
});

const patchQuizSchema = z.object({
  title: z.string().min(1).optional(),
  questions: z.array(quizQuestionSchema).min(1),
});

adminOnboardingRouter.patch("/steps/:stepId", async (req, res) => {
  const stepId = req.params.stepId;
  const existing = await prisma.onboardingStep.findUnique({
    where: { id: stepId },
    include: stepInclude,
  });
  if (!existing) {
    res.status(404).json({ error: "Step not found" });
    return;
  }
  if (existing.kind === OnboardingStepKind.LESSON) {
    const parsed = patchLessonSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    if (parsed.data.title === undefined && parsed.data.lessonContent === undefined) {
      res.status(400).json({ error: "Provide title and/or lessonContent to update" });
      return;
    }
    const step = await prisma.onboardingStep.update({
      where: { id: stepId },
      data: parsed.data,
      include: stepInclude,
    });
    res.json({ step });
    return;
  }
  const parsed = patchQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body for quiz step" });
    return;
  }
  try {
    assertSingleCorrectPerQuestion(parsed.data.questions);
    await prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { stepId } });
      await tx.onboardingStep.update({
        where: { id: stepId },
        data: { title: parsed.data.title ?? existing.title },
      });
      for (let qi = 0; qi < parsed.data.questions.length; qi++) {
        const q = parsed.data.questions[qi];
        await tx.quizQuestion.create({
          data: {
            stepId,
            sortOrder: qi,
            prompt: q.prompt,
            options: {
              create: q.options.map((o, oi) => ({
                sortOrder: oi,
                label: o.label,
                isCorrect: o.isCorrect,
              })),
            },
          },
        });
      }
    });
    const step = await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId },
      include: stepInclude,
    });
    res.json({ step });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update quiz";
    res.status(400).json({ error: msg });
  }
});

adminOnboardingRouter.delete("/steps/:stepId", async (req, res) => {
  const step = await prisma.onboardingStep.findUnique({
    where: { id: req.params.stepId },
  });
  if (!step) {
    res.status(404).json({ error: "Step not found" });
    return;
  }
  const programId = step.programId;
  await prisma.onboardingStep.delete({ where: { id: step.id } });
  await renumberSteps(programId);
  res.status(204).send();
});

const reorderSchema = z.object({
  orderedStepIds: z.array(z.string().uuid()).min(1),
});

adminOnboardingRouter.post("/programs/:programId/steps/reorder", async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const programId = req.params.programId;
  const steps = await prisma.onboardingStep.findMany({
    where: { programId },
    select: { id: true },
  });
  const ids = new Set(steps.map((s) => s.id));
  const ordered = parsed.data.orderedStepIds;
  if (ordered.length !== ids.size || ordered.some((id) => !ids.has(id))) {
    res.status(400).json({ error: "orderedStepIds must list every step exactly once" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) {
      await tx.onboardingStep.update({ where: { id: ordered[i] }, data: { sortOrder: -(i + 1) } });
    }
    for (let i = 0; i < ordered.length; i++) {
      await tx.onboardingStep.update({ where: { id: ordered[i] }, data: { sortOrder: i } });
    }
  });
  res.json({ ok: true });
});
