-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM ('LOGIN', 'REVALIDATE');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REVALIDATE_OK';
ALTER TYPE "AuditAction" ADD VALUE 'REVALIDATE_FAIL';

-- AlterTable
ALTER TABLE "AuthChallenge" ADD COLUMN "purpose" "ChallengePurpose" NOT NULL DEFAULT 'LOGIN';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "lastRevalidatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
