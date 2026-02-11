import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        deviceId: string;
        sessionId: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

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
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
