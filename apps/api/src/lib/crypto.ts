import crypto from "crypto";

export function generateNonce(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function generateOtpCode(): string {
  return `${crypto.randomInt(0, 1_000_000)}`.padStart(6, "0");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function verifyEd25519Signature(
  publicKeyPem: string,
  payload: string,
  signatureBase64: string,
): boolean {
  try {
    const signature = Buffer.from(signatureBase64, "base64");
    const keyObject = crypto.createPublicKey(publicKeyPem);

    return crypto.verify(null, Buffer.from(payload, "utf8"), keyObject, signature);
  } catch {
    return false;
  }
}
