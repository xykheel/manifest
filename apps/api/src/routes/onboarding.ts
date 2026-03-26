import { OnboardingEnrollmentStatus, OnboardingStepKind } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const onboardingRouter = Router();

const stepIncludePlayer = {
  quizQuestions: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      options: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

function stripQuizForPlayer(step: {
  id: string;
  kind: OnboardingStepKind;
  title: string;
  lessonContent: string | null;
  quizQuestions: {
    id: string;
    sortOrder: number;
    prompt: string;
    options: { id: string; sortOrder: number; label: string }[];
  }[];
}) {
  if (step.kind !== OnboardingStepKind.QUIZ) return null;
  return {
    id: step.id,
    kind: "QUIZ" as const,
    title: step.title,
    questions: step.quizQuestions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    })),
  };
}

function stepOutline(
  steps: { id: string; sortOrder: number; kind: OnboardingStepKind; title: string }[],
  enrollment: {
    status: OnboardingEnrollmentStatus;
    currentStepIndex: number;
  } | null,
) {
  return steps.map((s, index) => ({
    id: s.id,
    sortOrder: s.sortOrder,
    kind: s.kind,
    title: s.title,
    completed:
      enrollment?.status === OnboardingEnrollmentStatus.COMPLETED ||
      (enrollment?.status === OnboardingEnrollmentStatus.IN_PROGRESS &&
        index < enrollment.currentStepIndex),
  }));
}

onboardingRouter.get("/programs", async (req, res) => {
  const userId = req.user!.sub;
  const programs = await prisma.onboardingProgram.findMany({
    where: { published: true },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { select: { id: true } },
      enrollments: { where: { userId }, take: 1 },
    },
  });
  res.json({
    programs: programs.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      stepCount: p.steps.length,
      enrollment: p.enrollments[0]
        ? {
            status: p.enrollments[0].status,
            currentStepIndex: p.enrollments[0].currentStepIndex,
            startedAt: p.enrollments[0].startedAt,
            completedAt: p.enrollments[0].completedAt,
          }
        : null,
    })),
  });
});

onboardingRouter.get("/programs/:programId", async (req, res) => {
  const userId = req.user!.sub;
  const programId = req.params.programId;
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, kind: true, title: true } },
      enrollments: { where: { userId }, take: 1 },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  const enrollment = program.enrollments[0] ?? null;
  res.json({
    program: {
      id: program.id,
      title: program.title,
      description: program.description,
    },
    stepsOutline: stepOutline(program.steps, enrollment),
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          currentStepIndex: enrollment.currentStepIndex,
          startedAt: enrollment.startedAt,
          completedAt: enrollment.completedAt,
        }
      : null,
  });
});

onboardingRouter.post("/programs/:programId/start", async (req, res) => {
  const userId = req.user!.sub;
  const programId = req.params.programId;
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true },
  });
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  const existing = await prisma.userOnboardingEnrollment.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (existing) {
    res.json({
      enrollment: {
        id: existing.id,
        status: existing.status,
        currentStepIndex: existing.currentStepIndex,
        startedAt: existing.startedAt,
        completedAt: existing.completedAt,
      },
    });
    return;
  }
  const enrollment = await prisma.userOnboardingEnrollment.create({
    data: { userId, programId },
  });
  res.status(201).json({
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      currentStepIndex: enrollment.currentStepIndex,
      startedAt: enrollment.startedAt,
      completedAt: enrollment.completedAt,
    },
  });
});

onboardingRouter.get("/programs/:programId/player", async (req, res) => {
  const userId = req.user!.sub;
  const programId = req.params.programId;
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, include: stepIncludePlayer },
      enrollments: { where: { userId }, take: 1 },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  const enrollment = program.enrollments[0] ?? null;
  if (!enrollment) {
    res.status(400).json({ error: "Start the program first" });
    return;
  }
  const steps = program.steps;
  const outline = stepOutline(steps, enrollment);
  if (enrollment.status === OnboardingEnrollmentStatus.COMPLETED) {
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        currentStepIndex: enrollment.currentStepIndex,
        completedAt: enrollment.completedAt,
      },
      stepsOutline: outline,
      currentStep: null,
      completed: true,
    });
    return;
  }
  if (enrollment.currentStepIndex >= steps.length) {
    await prisma.userOnboardingEnrollment.update({
      where: { id: enrollment.id },
      data: { status: OnboardingEnrollmentStatus.COMPLETED, completedAt: new Date() },
    });
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: steps.length,
        completedAt: new Date(),
      },
      stepsOutline: outline.map((o) => ({ ...o, completed: true })),
      currentStep: null,
      completed: true,
    });
    return;
  }
  const raw = steps[enrollment.currentStepIndex];
  const currentStep =
    raw.kind === OnboardingStepKind.LESSON
      ? { id: raw.id, kind: "LESSON" as const, title: raw.title, lessonContent: raw.lessonContent ?? "" }
      : stripQuizForPlayer(raw);
  res.json({
    program: { id: program.id, title: program.title, description: program.description },
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      currentStepIndex: enrollment.currentStepIndex,
      totalSteps: steps.length,
    },
    stepsOutline: outline,
    currentStep,
    completed: false,
  });
});

const completeStepSchema = z.object({
  answers: z.record(z.string().uuid(), z.string().uuid()).optional(),
});

onboardingRouter.post("/programs/:programId/complete-step", async (req, res) => {
  const userId = req.user!.sub;
  const programId = req.params.programId;
  const parsed = completeStepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, include: stepIncludePlayer },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  const enrollment = await prisma.userOnboardingEnrollment.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (!enrollment) {
    res.status(400).json({ error: "Start the program first" });
    return;
  }
  if (enrollment.status === OnboardingEnrollmentStatus.COMPLETED) {
    res.status(400).json({ error: "Program already completed" });
    return;
  }
  const steps = program.steps;
  const idx = enrollment.currentStepIndex;
  if (idx >= steps.length) {
    res.status(400).json({ error: "Nothing left to complete" });
    return;
  }
  const step = steps[idx];
  if (step.kind === OnboardingStepKind.QUIZ) {
    const answers = parsed.data.answers ?? {};
    for (const q of step.quizQuestions) {
      const chosen = answers[q.id];
      if (!chosen) {
        res.status(400).json({ error: `Answer required for question: ${q.prompt.slice(0, 40)}…` });
        return;
      }
      const opt = q.options.find((o) => o.id === chosen);
      if (!opt || !opt.isCorrect) {
        res.status(400).json({ error: "One or more answers are incorrect" });
        return;
      }
    }
  }
  const nextIndex = idx + 1;
  if (nextIndex >= steps.length) {
    await prisma.userOnboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: nextIndex,
        completedAt: new Date(),
      },
    });
    res.json({
      completedProgram: true,
      enrollment: {
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: nextIndex,
        completedAt: new Date(),
      },
    });
    return;
  }
  await prisma.userOnboardingEnrollment.update({
    where: { id: enrollment.id },
    data: { currentStepIndex: nextIndex },
  });
  res.json({
    completedProgram: false,
    enrollment: {
      status: OnboardingEnrollmentStatus.IN_PROGRESS,
      currentStepIndex: nextIndex,
    },
  });
});
