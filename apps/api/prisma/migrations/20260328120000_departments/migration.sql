-- CreateEnum
CREATE TYPE "Department" AS ENUM (
  'DEVELOPMENT',
  'LEADERSHIP',
  'OPTIMISATION',
  'DELIVERY',
  'QUALITY_ASSURANCE',
  'EXPERIENCE_DESIGN',
  'OTHER',
  'SYSTEM_ADMINISTRATOR'
);

-- AlterTable
ALTER TABLE "OnboardingProgram" ADD COLUMN "department" "Department" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "UserDepartment" (
    "userId" UUID NOT NULL,
    "department" "Department" NOT NULL,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId","department")
);

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
