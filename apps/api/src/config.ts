import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return parsed;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenTtlSeconds: 15 * 60,
  registrationTokenTtlSeconds: 15 * 60,
  challengeTtlSeconds: 60,
  otpTtlSeconds: 300,
  refreshTokenTtlDays: 30,
  authRateLimitWindowMs: envNumber("AUTH_RATE_LIMIT_WINDOW_MS", 60_000),
  authRateLimitMax: envNumber("AUTH_RATE_LIMIT_MAX", 30),
  recoveryRateLimitWindowMs: envNumber("RECOVERY_RATE_LIMIT_WINDOW_MS", 60_000),
  recoveryRateLimitMax: envNumber("RECOVERY_RATE_LIMIT_MAX", 20),
  providerRateLimitWindowMs: envNumber("PROVIDER_RATE_LIMIT_WINDOW_MS", 60_000),
  providerRateLimitMax: envNumber("PROVIDER_RATE_LIMIT_MAX", 60),
};
