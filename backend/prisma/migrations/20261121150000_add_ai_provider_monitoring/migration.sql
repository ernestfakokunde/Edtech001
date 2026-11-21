CREATE TABLE "AiProviderCall" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "outputCharacters" INTEGER,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProviderCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProviderCall_createdAt_idx" ON "AiProviderCall"("createdAt");
CREATE INDEX "AiProviderCall_provider_createdAt_idx" ON "AiProviderCall"("provider", "createdAt");
CREATE INDEX "AiProviderCall_feature_createdAt_idx" ON "AiProviderCall"("feature", "createdAt");
