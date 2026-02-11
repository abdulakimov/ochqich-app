import { z } from "zod";

export const registerDeviceSchema = z.object({
  phone: z.string().min(6).max(24),
  fingerprint: z.string().min(8).max(256),
  publicKey: z.string().min(20),
  deviceName: z.string().min(1).max(64).optional(),
});

export const challengeSchema = z.object({
  deviceId: z.string().min(5),
});

export const confirmSchema = z.object({
  challengeId: z.string().min(5),
  signature: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});
