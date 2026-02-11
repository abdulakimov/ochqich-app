import {
  AuditAction,
  ChallengePurpose,
  ChallengeStatus,
  ConsentRequestStatus,
  DeviceStatus,
  OtpPurpose,
  Prisma,
  SessionStatus,
} from "@prisma/client";
import { Router } from "express";
import { config } from "../config";
import { writeAuditLog } from "../lib/audit";
import {
  generateNonce,
  generateOtpCode,
  generateRefreshToken,
  hashToken,
  verifyEd25519Signature,
} from "../lib/crypto";
import { signAccessToken, signRegistrationToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import {
  approveConsentSchema,
  challengeSchema,
  confirmSchema,
  createConsentRequestSchema,
  denyConsentSchema,
  generateRecoveryCodesSchema,
  recoveryStartOtpSchema,
  recoveryVerifyOtpSchema,
  refreshSchema,
  registerDeviceSchema,
  registerOtpSchema,
  useRecoveryCodeSchema,
  verifyOtpSchema,
  zodErrorPayload,
} from "../lib/validation";
import { requireAuth, requireRecentRevalidation } from "../middleware/auth";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { logger } from "../lib/logger";

const RECOVERY_OTP_MAX_ATTEMPTS = 5;
const RECOVERY_CODE_MAX_ATTEMPTS = 5;
const RECOVERY_RATE_WINDOW_MS = 10 * 60 * 1000;

function generateRecoveryCode(): string {
  return `${generateOtpCode()}-${generateOtpCode()}`;
}

async function checkRecoveryRateLimit(scope: "code" | "otp", key: string): Promise<boolean> {
  const since = new Date(Date.now() - RECOVERY_RATE_WINDOW_MS);
  const attempts = await prisma.auditLog.count({
    where: {
      action:
        scope === "code"
          ? { in: [AuditAction.RECOVERY_CODE_USE_FAIL, AuditAction.RECOVERY_RATE_LIMIT_HIT] }
          : { in: [AuditAction.RECOVERY_OTP_VERIFY_FAIL, AuditAction.RECOVERY_RATE_LIMIT_HIT] },
      createdAt: { gte: since },
      metadata: {
        path: [scope === "code" ? "recoveryCodeHash" : "phone"],
        equals: key,
      },
    },
  });

  return attempts >= (scope === "code" ? RECOVERY_CODE_MAX_ATTEMPTS : RECOVERY_OTP_MAX_ATTEMPTS);
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}

function getProviderApiKey(headers: Record<string, string | string[] | undefined>): string | null {
  const explicitApiKey = headers["x-api-key"];
  if (typeof explicitApiKey === "string" && explicitApiKey.trim().length > 0) {
    return explicitApiKey.trim();
  }

  const authHeader = headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("ApiKey ")) {
    const token = authHeader.slice("ApiKey ".length).trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

function toUniqueAttributes(attributes: string[]): string[] {
  return [...new Set(attributes.map((item) => item.trim()).filter((item) => item.length > 0))];
}

async function dispatchConsentWebhook(consentRequestId: string): Promise<void> {
  const payload = await prisma.consentRequest.findUnique({
    where: { id: consentRequestId },
    include: {
      provider: true,
      decision: true,
    },
  });

  if (!payload?.provider.webhookUrl || !payload.decision) {
    return;
  }

  try {
    const response = await fetch(payload.provider.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consentRequestId: payload.id,
        providerId: payload.providerId,
        userId: payload.userId,
        status: payload.status,
        requestedAttributes: payload.requestedAttributes,
        decision: {
          approvedAttributes: payload.decision.approvedAttributes,
          deniedAttributes: payload.decision.deniedAttributes,
          decidedAt: payload.decision.decidedAt.toISOString(),
        },
      }),
    });

    await writeAuditLog({
      action: AuditAction.CONSENT_WEBHOOK_SENT,
      userId: payload.userId ?? undefined,
      metadata: {
        consentRequestId: payload.id,
        providerId: payload.providerId,
        webhookUrl: payload.provider.webhookUrl,
        statusCode: response.status,
      },
    });
  } catch (error) {
    await writeAuditLog({
      action: AuditAction.CONSENT_WEBHOOK_FAIL,
      userId: payload.userId ?? undefined,
      metadata: {
        consentRequestId: payload.id,
        providerId: payload.providerId,
        webhookUrl: payload.provider.webhookUrl,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
  }
}

export const v1Router = Router();

const authRateLimiter = createRateLimitMiddleware({
  name: "auth",
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
});

const recoveryRateLimiter = createRateLimitMiddleware({
  name: "recovery",
  windowMs: config.recoveryRateLimitWindowMs,
  max: config.recoveryRateLimitMax,
});

const providerRateLimiter = createRateLimitMiddleware({
  name: "provider",
  windowMs: config.providerRateLimitWindowMs,
  max: config.providerRateLimitMax,
});

v1Router.post("/auth/register", authRateLimiter, async (req, res) => {
  const parsed = registerOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const otpCode = generateOtpCode();
  const otpHash = hashToken(otpCode);
  const expiresAt = new Date(Date.now() + config.otpTtlSeconds * 1000);

  const otp = await prisma.$transaction(async (tx) => {
    await tx.otpVerification.updateMany({
      where: { phone: parsed.data.phone, verifiedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    return tx.otpVerification.create({
      data: {
        phone: parsed.data.phone,
        otpHash,
        purpose: OtpPurpose.AUTH,
        expiresAt,
      },
    });
  });

  await writeAuditLog({
    action: AuditAction.OTP_START,
    metadata: { phone: parsed.data.phone, otpId: otp.id },
  });

  return res.status(201).json({
    otpId: otp.id,
    expiresAt: otp.expiresAt.toISOString(),
    otpCode,
  });
});

v1Router.post("/auth/verify-otp", authRateLimiter, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const otp = await prisma.otpVerification.findUnique({ where: { id: parsed.data.otpId } });

  if (!otp || otp.phone !== parsed.data.phone) {
    await writeAuditLog({
      action: AuditAction.OTP_VERIFY_FAIL,
      metadata: { reason: "otp_not_found", otpId: parsed.data.otpId, phone: parsed.data.phone },
    });
    return res.status(404).json({ message: "OTP not found" });
  }

  if (otp.verifiedAt) {
    return res.status(409).json({ message: "OTP already used" });
  }

  if (otp.expiresAt < new Date()) {
    await writeAuditLog({
      action: AuditAction.OTP_VERIFY_FAIL,
      metadata: { reason: "otp_expired", otpId: otp.id, phone: otp.phone },
    });
    return res.status(401).json({ message: "OTP expired" });
  }

  if (hashToken(parsed.data.otpCode) !== otp.otpHash) {
    await writeAuditLog({
      action: AuditAction.OTP_VERIFY_FAIL,
      metadata: { reason: "invalid_otp", otpId: otp.id, phone: otp.phone },
    });
    return res.status(401).json({ message: "Invalid OTP" });
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.otpVerification.update({
      where: { id: otp.id },
      data: { verifiedAt: new Date() },
    });

    return tx.user.upsert({
      where: { phone: otp.phone },
      update: {},
      create: { phone: otp.phone },
    });
  });

  await writeAuditLog({
    action: AuditAction.OTP_VERIFY_OK,
    userId: user.id,
    metadata: { otpId: otp.id },
  });

  const registrationToken = signRegistrationToken(user.id);

  return res.status(200).json({
    user: {
      id: user.id,
      phone: user.phone,
    },
    registrationToken,
  });
});

v1Router.post("/recovery/generate", requireAuth, requireRecentRevalidation, async (req, res) => {
  const parsed = generateRecoveryCodesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;
  if (requester.registration) {
    return res.status(403).json({ message: "Access token required" });
  }

  const count = parsed.data.count ?? 10;

  const recoveryCodes = Array.from({ length: count }, () => {
    const plainCode = generateRecoveryCode();
    return { plainCode, codeHash: hashToken(plainCode) };
  });

  await prisma.$transaction(async (tx) => {
    await tx.recoveryCode.deleteMany({ where: { userId: requester.userId, usedAt: null } });
    await tx.recoveryCode.createMany({
      data: recoveryCodes.map((item) => ({
        userId: requester.userId,
        codeHash: item.codeHash,
      })),
    });
  });

  await writeAuditLog({
    action: AuditAction.RECOVERY_CODE_GENERATE,
    userId: requester.userId,
    metadata: { count },
  });

  return res.status(201).json({ recoveryCodes: recoveryCodes.map((item) => item.plainCode) });
});

v1Router.post("/recovery/use", recoveryRateLimiter, async (req, res) => {
  const parsed = useRecoveryCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const recoveryCodeHash = hashToken(parsed.data.recoveryCode);
  if (await checkRecoveryRateLimit("code", recoveryCodeHash)) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_RATE_LIMIT_HIT,
      metadata: { scope: "code", recoveryCodeHash },
    });
    return res.status(429).json({ message: "Too many recovery attempts" });
  }

  const recoveryCode = await prisma.recoveryCode.findUnique({
    where: { codeHash: recoveryCodeHash },
    include: { user: true },
  });

  if (!recoveryCode || recoveryCode.usedAt) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_CODE_USE_FAIL,
      metadata: { reason: "invalid_or_used", recoveryCodeHash },
    });
    return res.status(401).json({ message: "Invalid recovery code" });
  }

  try {
    const device = await prisma.$transaction(
      async (tx) => {
        const existingDevice = await tx.device.findUnique({
          where: {
            userId_fingerprint: {
              userId: recoveryCode.userId,
              fingerprint: parsed.data.fingerprint,
            },
          },
        });

        if (existingDevice && existingDevice.status === DeviceStatus.ACTIVE) {
          throw new HttpError(409, "Device already active");
        }

        const activeCount = await tx.device.count({
          where: { userId: recoveryCode.userId, status: DeviceStatus.ACTIVE },
        });

        if (activeCount >= 2) {
          throw new HttpError(409, "ACTIVE device limit reached (max 2)");
        }

        const nextDevice = existingDevice
          ? await tx.device.update({
              where: { id: existingDevice.id },
              data: {
                status: DeviceStatus.ACTIVE,
                publicKey: parsed.data.publicKey,
                deviceName: parsed.data.deviceName,
              },
            })
          : await tx.device.create({
              data: {
                userId: recoveryCode.userId,
                fingerprint: parsed.data.fingerprint,
                publicKey: parsed.data.publicKey,
                deviceName: parsed.data.deviceName,
                status: DeviceStatus.ACTIVE,
              },
            });

        await tx.recoveryCode.update({
          where: { id: recoveryCode.id },
          data: { usedAt: new Date() },
        });

        return nextDevice;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const registrationToken = signRegistrationToken(recoveryCode.userId);

    await writeAuditLog({
      action: AuditAction.RECOVERY_CODE_USE_OK,
      userId: recoveryCode.userId,
      deviceId: device.id,
      metadata: { recoveryCodeId: recoveryCode.id },
    });

    return res.status(200).json({ deviceId: device.id, registrationToken });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    logger.error({ err: error }, "Unhandled route error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

v1Router.post("/recovery/start-otp", recoveryRateLimiter, async (req, res) => {
  const parsed = recoveryStartOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const otpCode = generateOtpCode();
  const otpHash = hashToken(otpCode);
  const expiresAt = new Date(Date.now() + config.otpTtlSeconds * 1000);

  const otp = await prisma.$transaction(async (tx) => {
    await tx.otpVerification.updateMany({
      where: {
        phone: parsed.data.phone,
        purpose: OtpPurpose.RECOVERY,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });

    return tx.otpVerification.create({
      data: {
        phone: parsed.data.phone,
        otpHash,
        purpose: OtpPurpose.RECOVERY,
        expiresAt,
      },
    });
  });

  await writeAuditLog({
    action: AuditAction.RECOVERY_OTP_START,
    metadata: { phone: parsed.data.phone, otpId: otp.id },
  });

  return res.status(201).json({
    otpId: otp.id,
    expiresAt: otp.expiresAt.toISOString(),
    otpCode,
  });
});

v1Router.post("/recovery/verify-otp", recoveryRateLimiter, async (req, res) => {
  const parsed = recoveryVerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  if (await checkRecoveryRateLimit("otp", parsed.data.phone)) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_RATE_LIMIT_HIT,
      metadata: { scope: "otp", phone: parsed.data.phone },
    });
    return res.status(429).json({ message: "Too many OTP attempts" });
  }

  const otp = await prisma.otpVerification.findUnique({ where: { id: parsed.data.otpId } });

  if (!otp || otp.phone !== parsed.data.phone || otp.purpose !== OtpPurpose.RECOVERY) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_OTP_VERIFY_FAIL,
      metadata: { reason: "otp_not_found", otpId: parsed.data.otpId, phone: parsed.data.phone },
    });
    return res.status(404).json({ message: "Recovery OTP not found" });
  }

  if (otp.verifiedAt) {
    return res.status(409).json({ message: "OTP already used" });
  }

  if (otp.expiresAt < new Date()) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_OTP_VERIFY_FAIL,
      metadata: { reason: "otp_expired", otpId: otp.id, phone: otp.phone },
    });
    return res.status(401).json({ message: "OTP expired" });
  }

  if (hashToken(parsed.data.otpCode) !== otp.otpHash) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_OTP_VERIFY_FAIL,
      metadata: { reason: "invalid_otp", otpId: otp.id, phone: otp.phone },
    });
    return res.status(401).json({ message: "Invalid OTP" });
  }

  const user = await prisma.user.findUnique({ where: { phone: otp.phone } });
  if (!user) {
    await writeAuditLog({
      action: AuditAction.RECOVERY_OTP_VERIFY_FAIL,
      metadata: { reason: "user_not_found", otpId: otp.id, phone: otp.phone },
    });
    return res.status(404).json({ message: "User not found" });
  }

  try {
    const device = await prisma.$transaction(
      async (tx) => {
        await tx.otpVerification.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });

        const existingDevice = await tx.device.findUnique({
          where: {
            userId_fingerprint: {
              userId: user.id,
              fingerprint: parsed.data.fingerprint,
            },
          },
        });

        if (existingDevice && existingDevice.status === DeviceStatus.ACTIVE) {
          throw new HttpError(409, "Device already active");
        }

        const activeCount = await tx.device.count({
          where: { userId: user.id, status: DeviceStatus.ACTIVE },
        });

        if (activeCount >= 2) {
          throw new HttpError(409, "ACTIVE device limit reached (max 2)");
        }

        return existingDevice
          ? tx.device.update({
              where: { id: existingDevice.id },
              data: {
                status: DeviceStatus.ACTIVE,
                publicKey: parsed.data.publicKey,
                deviceName: parsed.data.deviceName,
              },
            })
          : tx.device.create({
              data: {
                userId: user.id,
                fingerprint: parsed.data.fingerprint,
                publicKey: parsed.data.publicKey,
                deviceName: parsed.data.deviceName,
                status: DeviceStatus.ACTIVE,
              },
            });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const registrationToken = signRegistrationToken(user.id);

    await writeAuditLog({
      action: AuditAction.RECOVERY_OTP_VERIFY_OK,
      userId: user.id,
      deviceId: device.id,
      metadata: { otpId: otp.id },
    });

    return res.status(200).json({ deviceId: device.id, registrationToken });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    logger.error({ err: error }, "Unhandled route error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

v1Router.post("/devices/register", requireAuth, requireRecentRevalidation, async (req, res) => {
  const parsed = registerDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existingDevice = await tx.device.findUnique({
          where: {
            userId_fingerprint: {
              userId: requester.userId,
              fingerprint: parsed.data.fingerprint,
            },
          },
        });

        if (existingDevice && existingDevice.status === DeviceStatus.ACTIVE) {
          return { device: existingDevice, created: false, revived: false };
        }

        const activeCount = await tx.device.count({
          where: {
            userId: requester.userId,
            status: DeviceStatus.ACTIVE,
          },
        });

        if (activeCount >= 2) {
          throw new HttpError(409, "ACTIVE device limit reached (max 2)");
        }

        if (existingDevice && existingDevice.status === DeviceStatus.REVOKED) {
          const revived = await tx.device.update({
            where: { id: existingDevice.id },
            data: {
              status: DeviceStatus.ACTIVE,
              publicKey: parsed.data.publicKey,
              deviceName: parsed.data.deviceName,
            },
          });

          return { device: revived, created: false, revived: true };
        }

        const created = await tx.device.create({
          data: {
            userId: requester.userId,
            fingerprint: parsed.data.fingerprint,
            publicKey: parsed.data.publicKey,
            deviceName: parsed.data.deviceName,
            status: DeviceStatus.ACTIVE,
          },
        });

        return { device: created, created: true, revived: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeAuditLog({
      action: AuditAction.DEVICE_ADD,
      userId: requester.userId,
      deviceId: result.device.id,
      metadata: { revived: result.revived, created: result.created },
    });

    return res.status(result.created ? 201 : 200).json({ deviceId: result.device.id });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    logger.error({ err: error }, "Unhandled route error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

v1Router.post("/auth/challenge", authRateLimiter, async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const device = await prisma.device.findFirst({
    where: { id: parsed.data.deviceId, status: DeviceStatus.ACTIVE },
  });

  if (!device) {
    return res.status(404).json({ message: "Active device not found" });
  }

  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + config.challengeTtlSeconds * 1000);

  const challenge = await prisma.authChallenge.create({
    data: {
      deviceId: device.id,
      nonce,
      expiresAt,
      status: ChallengeStatus.PENDING,
    },
  });

  return res.status(201).json({
    challengeId: challenge.id,
    nonce,
    expiresAt: expiresAt.toISOString(),
  });
});

v1Router.post("/auth/confirm", authRateLimiter, async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: parsed.data.challengeId },
    include: { device: true },
  });

  if (!challenge || !challenge.device || challenge.device.status !== DeviceStatus.ACTIVE) {
    await writeAuditLog({
      action: AuditAction.LOGIN_FAIL,
      metadata: { reason: "challenge_or_device_not_found" },
    });
    return res.status(404).json({ message: "Challenge or device not found" });
  }

  if (challenge.status !== ChallengeStatus.PENDING) {
    await writeAuditLog({
      action: AuditAction.LOGIN_FAIL,
      userId: challenge.device.userId,
      deviceId: challenge.deviceId,
      metadata: { reason: "challenge_not_pending" },
    });
    return res.status(409).json({ message: "Challenge already used or expired" });
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { status: ChallengeStatus.EXPIRED },
    });

    await writeAuditLog({
      action: AuditAction.LOGIN_FAIL,
      userId: challenge.device.userId,
      deviceId: challenge.deviceId,
      metadata: { reason: "challenge_expired" },
    });

    return res.status(401).json({ message: "Challenge expired" });
  }

  const isValid = verifyEd25519Signature(
    challenge.device.publicKey,
    challenge.nonce,
    parsed.data.signature,
  );

  if (!isValid) {
    await writeAuditLog({
      action: AuditAction.LOGIN_FAIL,
      userId: challenge.device.userId,
      deviceId: challenge.deviceId,
      metadata: { reason: "invalid_signature" },
    });

    return res.status(401).json({ message: "Invalid signature" });
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.$transaction(async (tx) => {
    await tx.authChallenge.update({
      where: { id: challenge.id },
      data: {
        status: ChallengeStatus.USED,
        usedAt: new Date(),
      },
    });

    return tx.session.create({
      data: {
        userId: challenge.device.userId,
        deviceId: challenge.device.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        lastRevalidatedAt: new Date(),
        status: SessionStatus.ACTIVE,
      },
    });
  });

  const accessToken = signAccessToken({
    sub: challenge.device.userId,
    deviceId: challenge.device.id,
    sessionId: session.id,
  });

  await writeAuditLog({
    action: AuditAction.LOGIN_OK,
    userId: challenge.device.userId,
    deviceId: challenge.device.id,
  });

  return res.status(200).json({ accessToken, refreshToken });
});

v1Router.post("/auth/revalidate/challenge", authRateLimiter, requireAuth, async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;
  if (requester.registration || !requester.deviceId) {
    return res.status(403).json({ message: "Access token required" });
  }

  if (parsed.data.deviceId !== requester.deviceId) {
    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "device_mismatch", requestedDeviceId: parsed.data.deviceId },
    });
    return res.status(403).json({ message: "Device mismatch" });
  }

  const device = await prisma.device.findFirst({
    where: { id: requester.deviceId, userId: requester.userId, status: DeviceStatus.ACTIVE },
  });

  if (!device) {
    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "device_not_found" },
    });
    return res.status(404).json({ message: "Active device not found" });
  }

  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + config.challengeTtlSeconds * 1000);

  const challenge = await prisma.authChallenge.create({
    data: {
      deviceId: device.id,
      purpose: ChallengePurpose.REVALIDATE,
      nonce,
      expiresAt,
      status: ChallengeStatus.PENDING,
    },
  });

  return res.status(201).json({
    challengeId: challenge.id,
    nonce,
    expiresAt: expiresAt.toISOString(),
  });
});

v1Router.post("/auth/revalidate/confirm", authRateLimiter, requireAuth, async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;
  if (requester.registration || !requester.deviceId || !requester.sessionId) {
    return res.status(403).json({ message: "Access token required" });
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: parsed.data.challengeId },
    include: { device: true },
  });

  if (
    !challenge ||
    challenge.purpose !== ChallengePurpose.REVALIDATE ||
    !challenge.device ||
    challenge.device.status !== DeviceStatus.ACTIVE ||
    challenge.device.userId !== requester.userId ||
    challenge.deviceId !== requester.deviceId
  ) {
    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "challenge_or_device_not_found", challengeId: parsed.data.challengeId },
    });
    return res.status(404).json({ message: "Challenge or device not found" });
  }

  if (challenge.status !== ChallengeStatus.PENDING) {
    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "challenge_not_pending", challengeId: challenge.id },
    });
    return res.status(409).json({ message: "Challenge already used or expired" });
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { status: ChallengeStatus.EXPIRED },
    });

    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "challenge_expired", challengeId: challenge.id },
    });

    return res.status(401).json({ message: "Challenge expired" });
  }

  const isValid = verifyEd25519Signature(
    challenge.device.publicKey,
    challenge.nonce,
    parsed.data.signature,
  );

  if (!isValid) {
    await writeAuditLog({
      action: AuditAction.REVALIDATE_FAIL,
      userId: requester.userId,
      deviceId: requester.deviceId,
      metadata: { reason: "invalid_signature", challengeId: challenge.id },
    });
    return res.status(401).json({ message: "Invalid signature" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.authChallenge.update({
      where: { id: challenge.id },
      data: {
        status: ChallengeStatus.USED,
        usedAt: new Date(),
      },
    });

    await tx.session.update({
      where: { id: requester.sessionId! },
      data: { lastRevalidatedAt: new Date() },
    });
  });

  await writeAuditLog({
    action: AuditAction.REVALIDATE_OK,
    userId: requester.userId,
    deviceId: requester.deviceId,
    metadata: { challengeId: challenge.id, sessionId: requester.sessionId },
  });

  return res.status(200).json({ ok: true });
});

v1Router.post("/auth/refresh", authRateLimiter, async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const refreshTokenHash = hashToken(parsed.data.refreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: { device: true },
  });

  if (
    !session ||
    session.status !== SessionStatus.ACTIVE ||
    session.expiresAt < new Date() ||
    session.device.status !== DeviceStatus.ACTIVE
  ) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const nextRefreshToken = generateRefreshToken();

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(nextRefreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccessToken({
    sub: updatedSession.userId,
    deviceId: updatedSession.deviceId,
    sessionId: updatedSession.id,
  });

  return res.status(200).json({ accessToken, refreshToken: nextRefreshToken });
});

v1Router.post("/provider/consent-requests", providerRateLimiter, async (req, res) => {
  const apiKey = getProviderApiKey(req.headers);
  if (!apiKey) {
    return res.status(401).json({ message: "Missing provider apiKey" });
  }

  const parsed = createConsentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const provider = await prisma.provider.findUnique({ where: { apiKey } });
  if (!provider) {
    return res.status(401).json({ message: "Invalid provider apiKey" });
  }

  const requestedAttributes = toUniqueAttributes(parsed.data.requestedAttributes);
  if (requestedAttributes.length === 0) {
    return res.status(400).json({ message: "At least one requested attribute is required" });
  }

  const expiresAt = parsed.data.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000);
  if (expiresAt <= new Date()) {
    return res.status(400).json({ message: "expiresAt must be in the future" });
  }

  if (parsed.data.userId) {
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  }

  const consentRequest = await prisma.consentRequest.create({
    data: {
      providerId: provider.id,
      userId: parsed.data.userId,
      requestedAttributes,
      expiresAt,
      token: generateNonce(),
      status: ConsentRequestStatus.PENDING,
    },
  });

  const consentUrl = `${provider.redirectUri.replace(/\/$/, "")}/consent/${consentRequest.id}?token=${encodeURIComponent(consentRequest.token)}`;
  const qrText = `ochqich://consent/${consentRequest.id}?token=${encodeURIComponent(consentRequest.token)}`;

  await writeAuditLog({
    action: AuditAction.CONSENT_REQUEST_CREATE,
    userId: consentRequest.userId ?? undefined,
    metadata: {
      consentRequestId: consentRequest.id,
      providerId: provider.id,
      requestedAttributes,
      expiresAt: consentRequest.expiresAt.toISOString(),
    },
  });

  return res.status(201).json({
    consentRequestId: consentRequest.id,
    status: consentRequest.status,
    expiresAt: consentRequest.expiresAt.toISOString(),
    consentUrl,
    qrText,
  });
});

v1Router.get("/provider/consent-requests/:id", providerRateLimiter, async (req, res) => {
  const apiKey = getProviderApiKey(req.headers);
  if (!apiKey) {
    return res.status(401).json({ message: "Missing provider apiKey" });
  }

  const provider = await prisma.provider.findUnique({ where: { apiKey } });
  if (!provider) {
    return res.status(401).json({ message: "Invalid provider apiKey" });
  }

  const consentRequest = await prisma.consentRequest.findFirst({
    where: {
      id: req.params.id,
      providerId: provider.id,
    },
    include: {
      decision: true,
    },
  });

  if (!consentRequest) {
    return res.status(404).json({ message: "Consent request not found" });
  }

  if (consentRequest.status === ConsentRequestStatus.PENDING && consentRequest.expiresAt < new Date()) {
    await prisma.consentRequest.update({
      where: { id: consentRequest.id },
      data: { status: ConsentRequestStatus.EXPIRED },
    });

    consentRequest.status = ConsentRequestStatus.EXPIRED;
  }

  await writeAuditLog({
    action: AuditAction.CONSENT_RESULT_FETCH,
    userId: consentRequest.userId ?? undefined,
    metadata: {
      consentRequestId: consentRequest.id,
      providerId: provider.id,
      status: consentRequest.status,
    },
  });

  return res.status(200).json({
    consentRequestId: consentRequest.id,
    providerId: consentRequest.providerId,
    userId: consentRequest.userId,
    requestedAttributes: consentRequest.requestedAttributes,
    status: consentRequest.status,
    expiresAt: consentRequest.expiresAt.toISOString(),
    decision: consentRequest.decision
      ? {
          approvedAttributes: consentRequest.decision.approvedAttributes,
          deniedAttributes: consentRequest.decision.deniedAttributes,
          decidedAt: consentRequest.decision.decidedAt.toISOString(),
        }
      : null,
  });
});

v1Router.post("/consent/:id/approve", requireAuth, requireRecentRevalidation, async (req, res) => {
  const parsed = approveConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;
  if (requester.registration) {
    return res.status(403).json({ message: "Access token required" });
  }

  const consentRequest = await prisma.consentRequest.findUnique({ where: { id: req.params.id } });
  if (!consentRequest) {
    return res.status(404).json({ message: "Consent request not found" });
  }

  if (consentRequest.userId && consentRequest.userId !== requester.userId) {
    return res.status(403).json({ message: "You cannot decide this consent request" });
  }

  if (consentRequest.status !== ConsentRequestStatus.PENDING) {
    return res.status(409).json({ message: "Consent request already decided" });
  }

  if (consentRequest.expiresAt < new Date()) {
    await prisma.consentRequest.update({
      where: { id: consentRequest.id },
      data: { status: ConsentRequestStatus.EXPIRED },
    });

    return res.status(410).json({ message: "Consent request expired" });
  }

  const approvedAttributes = toUniqueAttributes(parsed.data.approvedAttributes);
  const allowed = new Set(consentRequest.requestedAttributes);
  const hasUnsupportedAttribute = approvedAttributes.some((item) => !allowed.has(item));
  if (hasUnsupportedAttribute) {
    return res.status(400).json({ message: "approvedAttributes must be subset of requestedAttributes" });
  }

  const deniedAttributes = consentRequest.requestedAttributes.filter(
    (item) => !approvedAttributes.includes(item),
  );

  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.consentRequest.update({
      where: { id: consentRequest.id },
      data: {
        status: ConsentRequestStatus.APPROVED,
        userId: consentRequest.userId ?? requester.userId,
      },
    });

    const decision = await tx.consentDecision.create({
      data: {
        consentRequestId: consentRequest.id,
        approvedAttributes,
        deniedAttributes,
        decidedAt: new Date(),
      },
    });

    return { updated, decision };
  });

  await writeAuditLog({
    action: AuditAction.CONSENT_APPROVE,
    userId: requester.userId,
    metadata: {
      consentRequestId: consentRequest.id,
      providerId: consentRequest.providerId,
      approvedAttributes,
      deniedAttributes,
    },
  });

  void dispatchConsentWebhook(consentRequest.id);

  return res.status(200).json({
    consentRequestId: decided.updated.id,
    status: decided.updated.status,
    decision: {
      approvedAttributes: decided.decision.approvedAttributes,
      deniedAttributes: decided.decision.deniedAttributes,
      decidedAt: decided.decision.decidedAt.toISOString(),
    },
  });
});

v1Router.post("/consent/:id/deny", requireAuth, requireRecentRevalidation, async (req, res) => {
  const parsed = denyConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(zodErrorPayload(parsed.error));
  }

  const requester = req.auth!;
  if (requester.registration) {
    return res.status(403).json({ message: "Access token required" });
  }

  const consentRequest = await prisma.consentRequest.findUnique({ where: { id: req.params.id } });
  if (!consentRequest) {
    return res.status(404).json({ message: "Consent request not found" });
  }

  if (consentRequest.userId && consentRequest.userId !== requester.userId) {
    return res.status(403).json({ message: "You cannot decide this consent request" });
  }

  if (consentRequest.status !== ConsentRequestStatus.PENDING) {
    return res.status(409).json({ message: "Consent request already decided" });
  }

  if (consentRequest.expiresAt < new Date()) {
    await prisma.consentRequest.update({
      where: { id: consentRequest.id },
      data: { status: ConsentRequestStatus.EXPIRED },
    });

    return res.status(410).json({ message: "Consent request expired" });
  }

  const deniedAttributes = parsed.data.deniedAttributes
    ? toUniqueAttributes(parsed.data.deniedAttributes)
    : consentRequest.requestedAttributes;
  const allowed = new Set(consentRequest.requestedAttributes);
  const hasUnsupportedAttribute = deniedAttributes.some((item) => !allowed.has(item));
  if (hasUnsupportedAttribute) {
    return res.status(400).json({ message: "deniedAttributes must be subset of requestedAttributes" });
  }

  const approvedAttributes = consentRequest.requestedAttributes.filter(
    (item) => !deniedAttributes.includes(item),
  );

  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.consentRequest.update({
      where: { id: consentRequest.id },
      data: {
        status: ConsentRequestStatus.DENIED,
        userId: consentRequest.userId ?? requester.userId,
      },
    });

    const decision = await tx.consentDecision.create({
      data: {
        consentRequestId: consentRequest.id,
        approvedAttributes,
        deniedAttributes,
        decidedAt: new Date(),
      },
    });

    return { updated, decision };
  });

  await writeAuditLog({
    action: AuditAction.CONSENT_DENY,
    userId: requester.userId,
    metadata: {
      consentRequestId: consentRequest.id,
      providerId: consentRequest.providerId,
      approvedAttributes,
      deniedAttributes,
    },
  });

  void dispatchConsentWebhook(consentRequest.id);

  return res.status(200).json({
    consentRequestId: decided.updated.id,
    status: decided.updated.status,
    decision: {
      approvedAttributes: decided.decision.approvedAttributes,
      deniedAttributes: decided.decision.deniedAttributes,
      decidedAt: decided.decision.decidedAt.toISOString(),
    },
  });
});

v1Router.post("/devices/:id/revoke", requireAuth, requireRecentRevalidation, async (req, res) => {
  const targetDeviceId = req.params.id;
  const requester = req.auth!;

  if (requester.registration) {
    return res.status(403).json({ message: "Access token required" });
  }

  const device = await prisma.device.findFirst({
    where: {
      id: targetDeviceId,
      userId: requester.userId,
    },
  });

  if (!device) {
    return res.status(404).json({ message: "Device not found" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id: device.id },
      data: { status: DeviceStatus.REVOKED },
    });

    await tx.session.updateMany({
      where: {
        deviceId: device.id,
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    action: AuditAction.DEVICE_REVOKE,
    userId: requester.userId,
    deviceId: device.id,
  });

  return res.status(200).json({ revoked: true, deviceId: device.id });
});
