-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OLLAMA', 'OPENAI', 'ANTHROPIC', 'OPENAI_COMPATIBLE');

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" "AiProvider" NOT NULL DEFAULT 'OLLAMA',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "encryptedApiKey" TEXT NOT NULL DEFAULT '',
    "selectedModel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);
