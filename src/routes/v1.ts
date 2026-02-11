import { Router } from "express";
import { ChallengeStatus, DeviceStatus, SessionStatus } from "@prisma/client";
import { config } from "../config";
import { writeAuditLog } from "../lib/audit";
import {
  generateNonce,
  generateRefreshToken,
  hashToken,
  verifyEd25519Signature,
} from "../lib/crypto";
import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import {
  challengeSchema,
  confirmSchema,
  refreshSchema,
  registerDeviceSchema,
} from "../lib/validation";
import { requireAuth } from "../middleware/auth";

export const v1Router = Router();

const MAX_ACTIVE_DEVICES = 2;
const ACTIVE_DEVICE_LIMIT_MESSAGE = `ACTIVE device limit reached (max ${MAX_ACTIVE_DEVICES})`;

v1Router.post("/devices/register", async (req, res) => {
  const parsed = registerDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { phone, fingerprint, publicKey, deviceName } = parsed.data;

  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });

  const existingDevice = await prisma.device.findUnique({
    where: {
      userId_fingerprint: {
        userId: user.id,
        fingerprint,
      },
    },
  });

  if (existingDevice && existingDevice.status === DeviceStatus.REVOKED) {
    const revived = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.device.count({
        where: {
          userId: user.id,
          status: DeviceStatus.ACTIVE,
        },
      });

      if (activeCount >= MAX_ACTIVE_DEVICES) {
        return null;
      }

      return tx.device.update({
        where: { id: existingDevice.id },
        data: {
          status: DeviceStatus.ACTIVE,
          publicKey,
          deviceName,
        },
      });
    });

    if (!revived) {
      return res.status(409).json({ message: ACTIVE_DEVICE_LIMIT_MESSAGE });
    }

    await writeAuditLog({
      action: "DEVICE_ADD",
      userId: user.id,
      deviceId: revived.id,
      metadata: { revived: true },
    });

    return res.status(200).json({ deviceId: revived.id });
  }

  if (existingDevice) {
    return res.status(200).json({ deviceId: existingDevice.id });
  }

  const activeCount = await prisma.device.count({
    where: {
      userId: user.id,
      status: DeviceStatus.ACTIVE,
    },
  });

  if (activeCount >= MAX_ACTIVE_DEVICES) {
    return res.status(409).json({ message: ACTIVE_DEVICE_LIMIT_MESSAGE });
  }

  const device = await prisma.device.create({
    data: {
      userId: user.id,
      fingerprint,
      publicKey,
      deviceName,
      status: DeviceStatus.ACTIVE,
    },
  });

  await writeAuditLog({
    action: "DEVICE_ADD",
    userId: user.id,
    deviceId: device.id,
  });

  return res.status(201).json({ deviceId: device.id });
});

v1Router.post("/auth/challenge", async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
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
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: parsed.data.challengeId },
    include: { device: true },
  });

  if (!challenge || !challenge.device || challenge.device.status !== DeviceStatus.ACTIVE) {
    await writeAuditLog({
      action: "LOGIN_FAIL",
      metadata: { reason: "challenge_or_device_not_found" },
    });
    return res.status(404).json({ message: "Challenge or device not found" });
  }

  if (challenge.status !== ChallengeStatus.PENDING) {
    await writeAuditLog({
      action: "LOGIN_FAIL",
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
      action: "LOGIN_FAIL",
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
      action: "LOGIN_FAIL",
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

  let accessToken: string;

  try {
    const session = await prisma.$transaction(async (tx) => {
      const consumeResult = await tx.authChallenge.updateMany({
        where: {
          id: challenge.id,
          status: ChallengeStatus.PENDING,
          expiresAt: { gte: new Date() },
        },
        data: {
          status: ChallengeStatus.USED,
          usedAt: new Date(),
        },
      });

      if (consumeResult.count !== 1) {
        throw new Error("challenge_not_pending");
      }

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

    accessToken = signAccessToken({
      sub: challenge.device.userId,
      deviceId: challenge.device.id,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "challenge_not_pending") {
      await writeAuditLog({
        action: "LOGIN_FAIL",
        userId: challenge.device.userId,
        deviceId: challenge.device.id,
        metadata: { reason: "challenge_not_pending" },
      });

      return res.status(409).json({ message: "Challenge already used or expired" });
    }

    throw error;
  }

  await writeAuditLog({
    action: "LOGIN_OK",
    userId: challenge.device.userId,
    deviceId: challenge.device.id,
  });

  return res.status(200).json({ accessToken, refreshToken });
});

v1Router.post("/auth/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
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
    action: "DEVICE_REVOKE",
    userId: requester.userId,
    deviceId: device.id,
  });

  return res.status(200).json({ revoked: true, deviceId: device.id });
});
