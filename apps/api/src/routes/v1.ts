import { AuditAction, ChallengeStatus, DeviceStatus, Prisma, SessionStatus } from "@prisma/client";
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
  challengeSchema,
  confirmSchema,
  refreshSchema,
  registerDeviceSchema,
  registerOtpSchema,
  verifyOtpSchema,
  zodErrorPayload,
} from "../lib/validation";
import { requireAuth } from "../middleware/auth";

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}

export const v1Router = Router();

v1Router.post("/auth/register", async (req, res) => {
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

v1Router.post("/auth/verify-otp", async (req, res) => {
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

v1Router.post("/devices/register", requireAuth, async (req, res) => {
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

    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

v1Router.post("/auth/challenge", async (req, res) => {
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

v1Router.post("/auth/confirm", async (req, res) => {
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

v1Router.post("/auth/refresh", async (req, res) => {
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

v1Router.post("/devices/:id/revoke", requireAuth, async (req, res) => {
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
