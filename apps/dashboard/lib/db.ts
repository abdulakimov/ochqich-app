import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DashboardDb, ProviderSettings } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "mvp-db.json");

const defaultProviderSettings: ProviderSettings = {
  name: process.env.PROVIDER_NAME ?? "Demo Provider",
  redirectUri: process.env.PROVIDER_REDIRECT_URI ?? "https://example.com/callback",
  webhookUrl: process.env.PROVIDER_WEBHOOK_URL ?? "https://example.com/webhook",
  apiKey: process.env.PROVIDER_API_KEY ?? "demo-api-key",
  updatedAt: new Date().toISOString()
};

const defaultDb: DashboardDb = {
  providerSettings: defaultProviderSettings,
  consentRequests: [],
  webhookLogs: []
};

export const generateApiKey = () => `pk_${crypto.randomBytes(16).toString("hex")}`;

async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(defaultDb, null, 2), "utf8");
  }
}

export async function readDb(): Promise<DashboardDb> {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw) as DashboardDb;
}

export async function writeDb(data: DashboardDb) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}
