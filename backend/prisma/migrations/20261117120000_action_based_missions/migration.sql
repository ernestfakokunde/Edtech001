CREATE TYPE "MissionActionType" AS ENUM ('FLASHCARD_SET_CREATED', 'QUIZ_CREATED', 'LEARN_MESSAGE_SENT');

ALTER TABLE "Mission"
  ADD COLUMN "actionType" "MissionActionType",
  ADD COLUMN "targetCount" INTEGER NOT NULL DEFAULT 1;

-- Existing missions had no verifiable completion condition. Pause them and
-- leave actionType unset so they cannot continue to award XP as free claims.
UPDATE "Mission" SET "isActive" = false;

CREATE TABLE "UserMissionProgress" (
  "profileId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMissionProgress_pkey" PRIMARY KEY ("profileId", "missionId"),
  CONSTRAINT "UserMissionProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserMissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserMissionProgress_missionId_idx" ON "UserMissionProgress"("missionId");
