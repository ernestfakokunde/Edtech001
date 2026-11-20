CREATE TABLE "LearnChat" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "topic" VARCHAR(200),
    "documentName" VARCHAR(255),
    "documentText" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearnChat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearnChat_profileId_updatedAt_idx" ON "LearnChat"("profileId", "updatedAt");
ALTER TABLE "LearnChat" ADD CONSTRAINT "LearnChat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
