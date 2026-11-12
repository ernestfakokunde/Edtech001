-- Email verification for new accounts. Existing accounts were created before
-- verification existed, so they are backfilled as verified rather than being
-- locked out of AI features after the deploy.
ALTER TABLE "Profile" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "Profile"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL;
