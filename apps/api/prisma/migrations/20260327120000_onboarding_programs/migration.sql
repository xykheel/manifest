-- CreateEnum
CREATE TYPE "OnboardingStepKind" AS ENUM ('LESSON', 'QUIZ');

-- CreateEnum
CREATE TYPE "OnboardingEnrollmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "OnboardingProgram" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "OnboardingStepKind" NOT NULL,
    "title" TEXT NOT NULL,
    "lessonContent" TEXT,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnboardingEnrollment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "status" "OnboardingEnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboardingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_programId_sortOrder_key" ON "OnboardingStep"("programId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboardingEnrollment_userId_programId_key" ON "UserOnboardingEnrollment"("userId", "programId");

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_programId_fkey" FOREIGN KEY ("programId") REFERENCES "OnboardingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboardingEnrollment" ADD CONSTRAINT "UserOnboardingEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboardingEnrollment" ADD CONSTRAINT "UserOnboardingEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "OnboardingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
