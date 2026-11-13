CREATE TABLE "AiCreditUsage" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCreditUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiCreditUsage_requestId_key" ON "AiCreditUsage"("requestId");
CREATE INDEX "AiCreditUsage_profileId_monthKey_status_idx" ON "AiCreditUsage"("profileId", "monthKey", "status");
ALTER TABLE "AiCreditUsage" ADD CONSTRAINT "AiCreditUsage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
