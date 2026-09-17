-- Account tiers (FREE default; PREMIUM unlocked later via payments), XP,
-- referral codes, and missions.
CREATE TYPE "AccountTier" AS ENUM ('FREE', 'PREMIUM');

-- Profile additions
ALTER TABLE "Profile" ADD COLUMN "tier" "AccountTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Profile" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Profile" ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "Profile_referralCode_key" ON "Profile"("referralCode");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Missions (created by the main admin) with one-claim-per-student tracking.
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserClaimedMission" (
    "profileId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserClaimedMission_pkey" PRIMARY KEY ("profileId","missionId")
);

CREATE INDEX "UserClaimedMission_missionId_idx" ON "UserClaimedMission"("missionId");

ALTER TABLE "UserClaimedMission" ADD CONSTRAINT "UserClaimedMission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserClaimedMission" ADD CONSTRAINT "UserClaimedMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;