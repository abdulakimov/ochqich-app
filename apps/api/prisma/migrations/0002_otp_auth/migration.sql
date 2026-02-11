-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'OTP_START';
ALTER TYPE "AuditAction" ADD VALUE 'OTP_VERIFY_OK';
ALTER TYPE "AuditAction" ADD VALUE 'OTP_VERIFY_FAIL';

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpVerification_phone_expiresAt_idx" ON "OtpVerification"("phone", "expiresAt");
