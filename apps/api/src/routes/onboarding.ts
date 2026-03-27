import { OnboardingEnrollmentStatus, OnboardingStepKind, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { getUserDepartments, publishedProgramWhereForUser } from "../lib/onboardingAccess";
import { prisma } from "../lib/prisma";

export const onboardingRouter = Router();

type StepSnapshots = Record<string, { answers?: Record<string, string> }>;

function parseStepSnapshots(raw: Prisma.JsonValue | null | undefined): StepSnapshots {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as StepSnapshots;
}

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

type PlayerOutlineRow = {
  id: string;
  sortOrder: number;
  kind: OnboardingStepKind | "SUMMARY";
  title: string;
  completed: boolean;
};

function stepOutline(
  steps: { id: string; sortOrder: number; kind: OnboardingStepKind; title: string }[],
  enrollment: {
    status: OnboardingEnrollmentStatus;
    currentStepIndex: number;
  } | null,
): PlayerOutlineRow[] {
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

type ProgramStepPlayer = Prisma.OnboardingStepGetPayload<{ include: typeof stepIncludePlayer }>;

type QuizSummaryPayload = {
  correctCount: number;
  questionCount: number;
  overallPercent: number;
  quizzes: { title: string; correct: number; total: number }[];
};

function computeQuizSummary(steps: ProgramStepPlayer[], snapshots: StepSnapshots): QuizSummaryPayload | null {
  let questionCount = 0;
  let correctCount = 0;
  const quizzes: { title: string; correct: number; total: number }[] = [];
  for (const step of steps) {
    if (step.kind !== OnboardingStepKind.QUIZ) continue;
    const saved = snapshots[step.id]?.answers ?? {};
    let qCorrect = 0;
    const qTotal = step.quizQuestions.length;
    for (const q of step.quizQuestions) {
      const chosen = saved[q.id];
      const opt = q.options.find((o) => o.id === chosen);
      if (opt?.isCorrect) qCorrect++;
    }
    questionCount += qTotal;
    correctCount += qCorrect;
    quizzes.push({ title: step.title, correct: qCorrect, total: qTotal });
  }
  if (questionCount === 0) return null;
  return {
    correctCount,
    questionCount,
    overallPercent: Math.round((correctCount / questionCount) * 100),
    quizzes,
  };
}

function stepsOutlinePlayer(
  steps: { id: string; sortOrder: number; kind: OnboardingStepKind; title: string }[],
  enrollment: {
    status: OnboardingEnrollmentStatus;
    currentStepIndex: number;
  } | null,
) {
  const base = stepOutline(steps, enrollment);
  if (
    enrollment?.status === OnboardingEnrollmentStatus.IN_PROGRESS &&
    steps.length > 0 &&
    enrollment.currentStepIndex === steps.length
  ) {
    return [
      {
        id: "__completion_summary__",
        sortOrder: -1,
        kind: "SUMMARY" as const,
        title: "Your results",
        completed: false,
      },
      ...base,
    ];
  }
  if (
    enrollment?.status === OnboardingEnrollmentStatus.COMPLETED &&
    steps.length > 0
  ) {
    return [
      {
        id: "__review_summary__",
        sortOrder: -1,
        kind: "SUMMARY" as const,
        title: "Summary",
        completed: true,
      },
      ...base,
    ];
  }
  return base;
}

function buildReviewSteps(steps: ProgramStepPlayer[], snapshots: StepSnapshots) {
  return steps.map((step) => {
    if (step.kind === OnboardingStepKind.LESSON) {
      return {
        id: step.id,
        kind: "LESSON" as const,
        title: step.title,
        lessonContent: step.lessonContent ?? "",
      };
    }
    const saved = snapshots[step.id]?.answers ?? {};
    return {
      id: step.id,
      kind: "QUIZ" as const,
      title: step.title,
      questions: step.quizQuestions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, label: o.label })),
      })),
      savedAnswers: saved,
    };
  });
}

onboardingRouter.get("/programs", async (req, res) => {
  const userId = req.user!.sub;
  const userDepartments = await getUserDepartments(userId);
  const visibility = publishedProgramWhereForUser(userDepartments);
  const programs = await prisma.onboardingProgram.findMany({
    where: { published: true, ...visibility },
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
  const userDepartments = await getUserDepartments(userId);
  const visibility = publishedProgramWhereForUser(userDepartments);
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true, ...visibility },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, kind: true, title: true } },
      enrollments: { where: { userId }, take: 1 },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
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
  const userDepartments = await getUserDepartments(userId);
  const visibility = publishedProgramWhereForUser(userDepartments);
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true, ...visibility },
  });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
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
  const userDepartments = await getUserDepartments(userId);
  const visibility = publishedProgramWhereForUser(userDepartments);
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true, ...visibility },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, include: stepIncludePlayer },
      enrollments: { where: { userId }, take: 1 },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }
  const enrollment = program.enrollments[0] ?? null;
  if (!enrollment) {
    res.status(400).json({ error: "Start the programme first" });
    return;
  }
  const steps = program.steps;
  if (steps.length === 0) {
    if (enrollment.status !== OnboardingEnrollmentStatus.COMPLETED) {
      await prisma.userOnboardingEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: OnboardingEnrollmentStatus.COMPLETED,
          currentStepIndex: 0,
          completedAt: new Date(),
        },
      });
    }
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: 0,
        totalSteps: 0,
        completedAt: enrollment.completedAt ?? new Date(),
      },
      stepsOutline: [],
      currentStep: null,
      completionSummary: { completionPercent: 100, quizSummary: null },
      reviewSteps: [],
      completed: true,
    });
    return;
  }
  const outline = stepsOutlinePlayer(steps, enrollment);
  if (enrollment.status === OnboardingEnrollmentStatus.COMPLETED) {
    const snapshots = parseStepSnapshots(enrollment.stepSnapshots);
    const quizSummary = computeQuizSummary(steps, snapshots);
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        currentStepIndex: enrollment.currentStepIndex,
        totalSteps: steps.length,
        completedAt: enrollment.completedAt,
      },
      stepsOutline: outline,
      currentStep: null,
      completionSummary: {
        completionPercent: 100,
        quizSummary,
      },
      reviewSteps: buildReviewSteps(steps, snapshots),
      completed: true,
    });
    return;
  }
  const atSummaryStep =
    enrollment.status === OnboardingEnrollmentStatus.IN_PROGRESS &&
    enrollment.currentStepIndex === steps.length;
  if (atSummaryStep) {
    const snapshots = parseStepSnapshots(enrollment.stepSnapshots);
    const quizSummary = computeQuizSummary(steps, snapshots);
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        currentStepIndex: enrollment.currentStepIndex,
        totalSteps: steps.length,
      },
      stepsOutline: outline,
      currentStep: {
        kind: "SUMMARY" as const,
        completionPercent: 100,
        quizSummary,
      },
      completed: false,
    });
    return;
  }
  if (
    enrollment.status === OnboardingEnrollmentStatus.IN_PROGRESS &&
    enrollment.currentStepIndex > steps.length
  ) {
    await prisma.userOnboardingEnrollment.update({
      where: { id: enrollment.id },
      data: { status: OnboardingEnrollmentStatus.COMPLETED, completedAt: new Date() },
    });
    const enrollmentAfter = await prisma.userOnboardingEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    const snapshots = parseStepSnapshots(enrollmentAfter?.stepSnapshots);
    const quizSummaryRepair = computeQuizSummary(steps, snapshots);
    res.json({
      program: { id: program.id, title: program.title, description: program.description },
      enrollment: {
        id: enrollment.id,
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: steps.length,
        totalSteps: steps.length,
        completedAt: enrollmentAfter?.completedAt ?? new Date(),
      },
      stepsOutline: stepsOutlinePlayer(steps, {
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: steps.length,
      }),
      currentStep: null,
      completionSummary: {
        completionPercent: 100,
        quizSummary: quizSummaryRepair,
      },
      reviewSteps: buildReviewSteps(steps, snapshots),
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
    stepsOutline: stepsOutlinePlayer(steps, enrollment),
    currentStep,
    completed: false,
  });
});

const completeStepSchema = z.object({
  answers: z.record(z.string().uuid(), z.string().uuid()).optional(),
  /** Required to move from the results summary step to COMPLETED state (avoids accidental double-submit skipping the summary). */
  finish: z.literal(true).optional(),
});

onboardingRouter.post("/programs/:programId/complete-step", async (req, res) => {
  const userId = req.user!.sub;
  const programId = req.params.programId;
  const parsed = completeStepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const userDepartments = await getUserDepartments(userId);
  const visibility = publishedProgramWhereForUser(userDepartments);
  const program = await prisma.onboardingProgram.findFirst({
    where: { id: programId, published: true, ...visibility },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, include: stepIncludePlayer },
    },
  });
  if (!program) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }
  const enrollment = await prisma.userOnboardingEnrollment.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (!enrollment) {
    res.status(400).json({ error: "Start the programme first" });
    return;
  }
  if (enrollment.status === OnboardingEnrollmentStatus.COMPLETED) {
    res.json({
      completedProgram: true,
      enrollment: {
        status: enrollment.status,
        currentStepIndex: enrollment.currentStepIndex,
        completedAt: enrollment.completedAt,
      },
    });
    return;
  }
  const steps = program.steps;
  const idx = enrollment.currentStepIndex;
  if (idx > steps.length) {
    res.status(400).json({ error: "Invalid progress" });
    return;
  }
  if (idx === steps.length) {
    if (parsed.data.finish !== true) {
      res.json({
        completedProgram: false,
        enrollment: {
          status: OnboardingEnrollmentStatus.IN_PROGRESS,
          currentStepIndex: steps.length,
        },
      });
      return;
    }
    const completedAt = new Date();
    await prisma.userOnboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: OnboardingEnrollmentStatus.COMPLETED,
        completedAt,
      },
    });
    res.json({
      completedProgram: true,
      enrollment: {
        status: OnboardingEnrollmentStatus.COMPLETED,
        currentStepIndex: steps.length,
        completedAt,
      },
    });
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
  const snapshots = parseStepSnapshots(enrollment.stepSnapshots);
  const nextSnapshots: StepSnapshots = { ...snapshots };
  if (step.kind === OnboardingStepKind.QUIZ) {
    nextSnapshots[step.id] = { answers: parsed.data.answers ?? {} };
  }
  const nextIndex = idx + 1;
  if (nextIndex >= steps.length) {
    await prisma.userOnboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepIndex: nextIndex,
        stepSnapshots: nextSnapshots as Prisma.InputJsonValue,
      },
    });
    res.json({
      completedProgram: false,
      enrollment: {
        status: OnboardingEnrollmentStatus.IN_PROGRESS,
        currentStepIndex: nextIndex,
      },
    });
    return;
  }
  await prisma.userOnboardingEnrollment.update({
    where: { id: enrollment.id },
    data: { currentStepIndex: nextIndex, stepSnapshots: nextSnapshots as Prisma.InputJsonValue },
  });
  res.json({
    completedProgram: false,
    enrollment: {
      status: OnboardingEnrollmentStatus.IN_PROGRESS,
      currentStepIndex: nextIndex,
    },
  });
});
