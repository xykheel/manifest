import { AuthProvider, UserRole as DbUserRole } from "@prisma/client";
import { UserRole } from "@manifest/shared";
import { hash } from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export const adminUsersRouter = Router();

const userListSelect = {
  id: true,
  email: true,
  role: true,
  authProvider: true,
  entraId: true,
  createdAt: true,
  updatedAt: true,
} as const;

adminUsersRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: userListSelect,
  });
  res.json({ users });
});

const createLocalUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([UserRole.ADMIN, UserRole.USER]).optional(),
});

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
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        authProvider: AuthProvider.LOCAL,
      },
      select: userListSelect,
    });
    res.status(201).json({ user });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Could not create user" });
  }
});

const patchUserSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.USER]),
});

adminUsersRouter.patch("/users/:userId", async (req, res) => {
  const parsed = patchUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const targetId = req.params.userId;
  const actorId = req.user!.sub;
  const newRole = parsed.data.role as DbUserRole;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, authProvider: true },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.role === DbUserRole.ADMIN && newRole === DbUserRole.USER) {
    const adminCount = await prisma.user.count({ where: { role: DbUserRole.ADMIN } });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot remove the last administrator" });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { role: newRole },
    select: userListSelect,
  });
  res.json({ user });
});
