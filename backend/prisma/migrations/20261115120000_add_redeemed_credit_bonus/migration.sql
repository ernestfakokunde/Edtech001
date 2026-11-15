ALTER TABLE "CodeRedemption"
ADD COLUMN "bonusCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "expiresAt" TIMESTAMP(3);

WITH latest_redemption AS (
  SELECT "profileId", MAX("createdAt") AS "redeemedAt"
  FROM "CodeRedemption"
  GROUP BY "profileId"
), active_paid_plan AS (
  SELECT DISTINCT ON (redemption."profileId")
    redemption."profileId",
    payment."plan"
  FROM latest_redemption AS redemption
  JOIN "Payment" AS payment
    ON payment."profileId" = redemption."profileId"
   AND payment."status" = 'SUCCESS'
   AND payment."paidAt" <= redemption."redeemedAt"
   AND payment."paidAt" > redemption."redeemedAt" - INTERVAL '30 days'
  ORDER BY redemption."profileId", payment."paidAt" DESC, payment."createdAt" DESC
)
UPDATE "Profile" AS profile
SET "subscriptionPlan" = paid."plan"
FROM active_paid_plan AS paid
WHERE profile."id" = paid."profileId"
  AND profile."subscriptionPlan" = 'STUDENT_PLUS'
  AND paid."plan" IN ('BASIC', 'PREMIUM');

UPDATE "CodeRedemption" AS redemption
SET
  "bonusCredits" = 300,
  "expiresAt" = redemption."createdAt" + (COALESCE(NULLIF(promo."premiumDays", 0), 30) * INTERVAL '1 day')
FROM "PromoCode" AS promo
WHERE promo."id" = redemption."codeId";

CREATE INDEX "CodeRedemption_profileId_expiresAt_idx"
ON "CodeRedemption"("profileId", "expiresAt");
