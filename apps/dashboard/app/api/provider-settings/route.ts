import { NextResponse } from "next/server";
import { generateApiKey, readDb, writeDb } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export async function GET() {
  if (!requireAuth()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  return NextResponse.json(db.providerSettings);
}

export async function PUT(request: Request) {
  if (!requireAuth()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    name?: string;
    redirectUri?: string;
    webhookUrl?: string;
    rotateApiKey?: boolean;
  };

  const db = await readDb();

  if (payload.rotateApiKey) {
    db.providerSettings.apiKey = generateApiKey();
  }

  const { rotateApiKey: _rotateApiKey, ...settingsPayload } = payload;

  db.providerSettings = {
    ...db.providerSettings,
    ...settingsPayload,
    apiKey: db.providerSettings.apiKey,
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  return NextResponse.json(db.providerSettings);
}
