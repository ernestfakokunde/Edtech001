ALTER TABLE "Profile"
ADD COLUMN "suspendedUntil" TIMESTAMP(3),
ADD COLUMN "suspensionReason" TEXT;
