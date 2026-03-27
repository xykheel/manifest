import { AuthProvider, Department, UserRole as DbUserRole } from "@prisma/client";
import { UserRole } from "@manifest/shared";
import { hash } from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export const adminUsersRouter = Router();

const userListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  authProvider: true,
  entraId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeUser(
  u: {
    departments: { department: Department }[];
  } & Record<string, unknown>,
) {
  const { departments: deptMemberships, ...rest } = u;
  return {
    ...rest,
    departments: deptMemberships.map((d) => d.department),
  };
}

adminUsersRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      ...userListSelect,
      departments: { select: { department: true } },
    },
  });
  res.json({ users: users.map(serializeUser) });
});

const createLocalUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  role: z.enum([UserRole.ADMIN, UserRole.USER]).optional(),
  departments: z.array(z.nativeEnum(Department)).optional(),
});

function normaliseName(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

adminUsersRouter.post("/users", async (req, res) => {
  const parsed = createLocalUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const role = (parsed.data.role ?? UserRole.USER) as DbUserRole;
  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const firstName = normaliseName(parsed.data.firstName);
    const lastName = normaliseName(parsed.data.lastName);
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        role,
        authProvider: AuthProvider.LOCAL,
        ...(parsed.data.departments?.length
          ? {
              departments: {
                create: parsed.data.departments.map((department) => ({ department })),
              },
            }
          : {}),
      },
      select: {
        ...userListSelect,
        departments: { select: { department: true } },
      },
    });
    res.status(201).json({ user: serializeUser(user) });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Could not create user" });
  }
});

const patchUserSchema = z
  .object({
    role: z.enum([UserRole.ADMIN, UserRole.USER]).optional(),
    departments: z.array(z.nativeEnum(Department)).optional(),
    firstName: z.union([z.string().max(120), z.null()]).optional(),
    lastName: z.union([z.string().max(120), z.null()]).optional(),
  })
  .refine(
    (b) =>
      b.role !== undefined ||
      b.departments !== undefined ||
      b.firstName !== undefined ||
      b.lastName !== undefined,
    { message: "Provide at least one field to update" },
  );

adminUsersRouter.patch("/users/:userId", async (req, res) => {
  const parsed = patchUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const targetId = req.params.userId;
  const newRole = parsed.data.role as unknown as DbUserRole | undefined;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, authProvider: true },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (newRole !== undefined && target.role === DbUserRole.ADMIN && newRole === DbUserRole.USER) {
    const adminCount = await prisma.user.count({ where: { role: DbUserRole.ADMIN } });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot remove the last administrator" });
      return;
    }
  }

  const namePatch: { firstName?: string | null; lastName?: string | null } = {};
  if (parsed.data.firstName !== undefined) {
    namePatch.firstName =
      parsed.data.firstName === null ? null : normaliseName(parsed.data.firstName);
  }
  if (parsed.data.lastName !== undefined) {
    namePatch.lastName =
      parsed.data.lastName === null ? null : normaliseName(parsed.data.lastName);
  }

  await prisma.$transaction(async (tx) => {
    if (newRole !== undefined) {
      await tx.user.update({ where: { id: targetId }, data: { role: newRole } });
    }
    if (parsed.data.departments !== undefined) {
      await tx.userDepartment.deleteMany({ where: { userId: targetId } });
      if (parsed.data.departments.length > 0) {
        await tx.userDepartment.createMany({
          data: parsed.data.departments.map((department) => ({ userId: targetId, department })),
        });
      }
    }
    if (Object.keys(namePatch).length > 0) {
      await tx.user.update({ where: { id: targetId }, data: namePatch });
    }
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: targetId },
    select: {
      ...userListSelect,
      departments: { select: { department: true } },
    },
  });
  res.json({ user: serializeUser(user) });
});
