-- Corrective migration: align live DB with email-based auth schema.
-- OtpChallenge and PendingRegistration are ephemeral (short TTL); clear rows so
-- NOT NULL additions cannot fail on any environment that still holds them.
DELETE FROM "OtpChallenge";
DELETE FROM "PendingRegistration";

-- DropIndex
DROP INDEX "OtpChallenge_phone_purpose_idx";

-- DropIndex
DROP INDEX "PendingRegistration_phone_key";

-- DropIndex
DROP INDEX "User_phoneNormalized_key";

-- AlterTable
ALTER TABLE "OtpChallenge" DROP COLUMN "phone",
ADD COLUMN     "email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PendingRegistration" DROP COLUMN "phone",
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneNormalized",
DROP COLUMN "phoneOriginal",
DROP COLUMN "phoneVerifiedAt";

-- CreateIndex
CREATE INDEX "OtpChallenge_email_purpose_idx" ON "OtpChallenge"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
