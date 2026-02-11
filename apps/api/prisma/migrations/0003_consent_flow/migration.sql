-- CreateEnum
CREATE TYPE "ConsentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_REQUEST_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_DENY';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_RESULT_FETCH';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_WEBHOOK_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_WEBHOOK_FAIL';

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT,
    "requestedAttributes" TEXT[],
    "status" "ConsentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentDecision" (
    "id" TEXT NOT NULL,
    "consentRequestId" TEXT NOT NULL,
    "approvedAttributes" TEXT[],
    "deniedAttributes" TEXT[],
    "decidedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_apiKey_key" ON "Provider"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRequest_token_key" ON "ConsentRequest"("token");

-- CreateIndex
CREATE INDEX "ConsentRequest_providerId_status_idx" ON "ConsentRequest"("providerId", "status");

-- CreateIndex
CREATE INDEX "ConsentRequest_userId_status_idx" ON "ConsentRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ConsentRequest_expiresAt_status_idx" ON "ConsentRequest"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDecision_consentRequestId_key" ON "ConsentDecision"("consentRequestId");

-- CreateIndex
CREATE INDEX "ConsentDecision_decidedAt_idx" ON "ConsentDecision"("decidedAt");

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentDecision" ADD CONSTRAINT "ConsentDecision_consentRequestId_fkey" FOREIGN KEY ("consentRequestId") REFERENCES "ConsentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
