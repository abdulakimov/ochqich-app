import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AccessTokenPayload {
  sub: string;
  deviceId: string;
  sessionId: string;
}

export interface RegistrationTokenPayload {
  sub: string;
  type: "registration";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.accessTokenTtlSeconds,
  });
}

export function signRegistrationToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "registration" satisfies RegistrationTokenPayload["type"] },
    config.jwtSecret,
    {
      expiresIn: config.registrationTokenTtlSeconds,
    },
  );
}

export function verifyToken(token: string): AccessTokenPayload | RegistrationTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AccessTokenPayload | RegistrationTokenPayload;
}
