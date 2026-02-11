import { ZodError, z } from "zod";

export const registerOtpSchema = z.object({
  phone: z.string().min(6).max(24),
});

export const verifyOtpSchema = z.object({
  otpId: z.string().min(5),
  phone: z.string().min(6).max(24),
  otpCode: z.string().regex(/^\d{6}$/),
});

export const generateRecoveryCodesSchema = z.object({
  count: z.number().int().min(10).max(12).optional(),
});

export const useRecoveryCodeSchema = z.object({
  recoveryCode: z.string().min(8).max(128),
  fingerprint: z.string().min(8).max(256),
  publicKey: z.string().min(20),
  deviceName: z.string().min(1).max(64).optional(),
});

export const recoveryStartOtpSchema = z.object({
  phone: z.string().min(6).max(24),
});

export const recoveryVerifyOtpSchema = z.object({
  otpId: z.string().min(5),
  phone: z.string().min(6).max(24),
  otpCode: z.string().regex(/^\d{6}$/),
  fingerprint: z.string().min(8).max(256),
  publicKey: z.string().min(20),
  deviceName: z.string().min(1).max(64).optional(),
});

export const registerDeviceSchema = z.object({
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

const attributeSchema = z.string().min(1).max(128);

export const createConsentRequestSchema = z.object({
  userId: z.string().min(5).optional(),
  requestedAttributes: z.array(attributeSchema).min(1),
  expiresAt: z.coerce.date().optional(),
});

export const approveConsentSchema = z.object({
  approvedAttributes: z.array(attributeSchema).min(1),
});

export const denyConsentSchema = z.object({
  deniedAttributes: z.array(attributeSchema).min(1).optional(),
});

export function zodErrorPayload(error: ZodError) {
  return {
    message: "Validation failed",
    errors: error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  };
}
