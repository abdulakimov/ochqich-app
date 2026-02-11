import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenTtlSeconds: 15 * 60,
  registrationTokenTtlSeconds: 15 * 60,
  challengeTtlSeconds: 60,
  otpTtlSeconds: 300,
  refreshTokenTtlDays: 30,
};
