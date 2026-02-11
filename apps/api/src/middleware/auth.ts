import { SessionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { RegistrationTokenPayload, verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        deviceId?: string;
        sessionId?: string;
        registration?: boolean;
        lastRevalidatedAt?: Date;
      };
    }
  }
}

function isRegistrationTokenPayload(payload: unknown): payload is RegistrationTokenPayload {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "type" in payload &&
      (payload as RegistrationTokenPayload).type === "registration",
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    if (isRegistrationTokenPayload(payload)) {
      req.auth = {
        userId: payload.sub,
        registration: true,
      };

      return next();
    }

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        deviceId: payload.deviceId,
        status: "ACTIVE",
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    req.auth = {
      userId: payload.sub,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
      registration: false,
      lastRevalidatedAt: session.lastRevalidatedAt,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

const REVALIDATION_WINDOW_MS = 42 * 60 * 60 * 1000;

export async function requireRecentRevalidation(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.registration || !req.auth.sessionId) {
    return res.status(401).json({ message: "Access token required" });
  }

  const session = await prisma.session.findUnique({
    where: { id: req.auth.sessionId },
    select: {
      status: true,
      expiresAt: true,
      lastRevalidatedAt: true,
    },
  });

  if (!session || session.status !== SessionStatus.ACTIVE || session.expiresAt < new Date()) {
    return res.status(401).json({ message: "Session expired or revoked" });
  }

  if (session.lastRevalidatedAt.getTime() + REVALIDATION_WINDOW_MS <= Date.now()) {
    return res.status(403).json({ message: "REVALIDATION_REQUIRED" });
  }

  req.auth.lastRevalidatedAt = session.lastRevalidatedAt;
  return next();
}
