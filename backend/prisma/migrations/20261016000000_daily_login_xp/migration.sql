-- Automatically award 100 XP for a successful sign-in once per UTC day.
CREATE TABLE "DailyLoginReward" (
    "profileId" TEXT NOT NULL,
    "rewardDay" VARCHAR(10) NOT NULL,
    "xpAwarded" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLoginReward_pkey" PRIMARY KEY ("profileId", "rewardDay")
);

CREATE INDEX "DailyLoginReward_rewardDay_idx" ON "DailyLoginReward"("rewardDay");

ALTER TABLE "DailyLoginReward" ADD CONSTRAINT "DailyLoginReward_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
