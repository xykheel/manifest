import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@example.com";
  const password = "Admin123!";
  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      authProvider: "LOCAL",
    },
    // Do not reset password on every seed (e.g. Docker restart)
    update: { role: "ADMIN" },
  });

  const userPass = await hash("User123!", 12);
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    create: {
      email: "user@example.com",
      passwordHash: userPass,
      role: "USER",
      authProvider: "LOCAL",
    },
    update: { role: "USER" },
  });

  console.log("Seeded admin@example.com / Admin123! and user@example.com / User123!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
