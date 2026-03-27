import { OnboardingEnrollmentStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const adminAnalyticsRouter = Router();

function formatMonthLabelYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

adminAnalyticsRouter.get("/analytics", async (_req, res) => {
  const [
    userCount,
    publishedProgrammeCount,
    statusGroups,
    programmes,
    enrolledUserGroups,
    completionsByMonthRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.onboardingProgram.count({ where: { published: true } }),
    prisma.userOnboardingEnrollment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.onboardingProgram.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        published: true,
        enrollments: { select: { status: true } },
      },
    }),
    prisma.userOnboardingEnrollment.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ ym: string; cnt: bigint }[]>`
      SELECT to_char(date_trunc('month', "completedAt"), 'YYYY-MM') AS ym, COUNT(*)::bigint AS cnt
      FROM "UserOnboardingEnrollment"
      WHERE "completedAt" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const completedCount =
    statusGroups.find((g) => g.status === OnboardingEnrollmentStatus.COMPLETED)?._count._all ?? 0;
  const inProgressCount =
    statusGroups.find((g) => g.status === OnboardingEnrollmentStatus.IN_PROGRESS)?._count._all ?? 0;
  const totalEnrollments = completedCount + inProgressCount;

  const programmeStats = programmes.map((p) => ({
    programId: p.id,
    title: p.title,
    published: p.published,
    enrollmentCount: p.enrollments.length,
    completedCount: p.enrollments.filter((e) => e.status === OnboardingEnrollmentStatus.COMPLETED).length,
    inProgressCount: p.enrollments.filter((e) => e.status === OnboardingEnrollmentStatus.IN_PROGRESS).length,
  }));

  const completionGroups = await prisma.userOnboardingEnrollment.groupBy({
    by: ["userId"],
    where: { status: OnboardingEnrollmentStatus.COMPLETED },
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: 20,
  });

  const leaderIds = completionGroups.map((g) => g.userId);
  const leaderUsers =
    leaderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: leaderIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
  const userById = new Map(leaderUsers.map((u) => [u.id, u]));

  const topCompleters = completionGroups.map((g) => {
    const u = userById.get(g.userId);
    return {
      userId: g.userId,
      completedProgrammes: g._count._all,
      email: u?.email ?? "",
      firstName: u?.firstName ?? null,
      lastName: u?.lastName ?? null,
    };
  });

  const recentCompletions = await prisma.userOnboardingEnrollment.findMany({
    where: { status: OnboardingEnrollmentStatus.COMPLETED, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 25,
    select: {
      completedAt: true,
      user: { select: { email: true, firstName: true, lastName: true } },
      program: { select: { title: true } },
    },
  });

  const completionsByMonth = completionsByMonthRaw.map((row) => ({
    month: row.ym,
    label: formatMonthLabelYm(row.ym),
    count: Number(row.cnt),
  }));

  res.json({
    totals: {
      users: userCount,
      publishedProgrammes: publishedProgrammeCount,
      learnersWithEnrollment: enrolledUserGroups.length,
      totalEnrollments,
      enrollmentsCompleted: completedCount,
      enrollmentsInProgress: inProgressCount,
    },
    programmeStats,
    topCompleters,
    recentCompletions: recentCompletions.map((r) => ({
      completedAt: r.completedAt!.toISOString(),
      programmeTitle: r.program.title,
      userEmail: r.user.email,
      userFirstName: r.user.firstName,
      userLastName: r.user.lastName,
    })),
    completionsByMonth,
  });
});
