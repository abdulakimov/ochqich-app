-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('AUTH', 'RECOVERY');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_CODE_GENERATE';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_CODE_USE_OK';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_CODE_USE_FAIL';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_OTP_START';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_OTP_VERIFY_OK';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_OTP_VERIFY_FAIL';
ALTER TYPE "AuditAction" ADD VALUE 'RECOVERY_RATE_LIMIT_HIT';

-- AlterTable
ALTER TABLE "OtpVerification" ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'AUTH';

-- DropIndex
DROP INDEX "OtpVerification_phone_expiresAt_idx";

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_usedAt_idx" ON "RecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "OtpVerification_phone_purpose_expiresAt_idx" ON "OtpVerification"("phone", "purpose", "expiresAt");

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
