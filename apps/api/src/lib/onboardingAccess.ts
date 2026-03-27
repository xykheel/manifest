import { Department, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function getUserDepartments(userId: string): Promise<Department[]> {
  const rows = await prisma.userDepartment.findMany({
    where: { userId },
    select: { department: true },
  });
  return rows.map((r) => r.department);
}

/** Narrow visible programmes for non–system-administrators. */
export function publishedProgramWhereForUser(
  userDepartments: Department[],
): Prisma.OnboardingProgramWhereInput {
  if (userDepartments.includes(Department.SYSTEM_ADMINISTRATOR)) {
    return {};
  }
  if (userDepartments.length === 0) {
    return { id: { in: [] } };
  }
  return { department: { in: userDepartments } };
}
