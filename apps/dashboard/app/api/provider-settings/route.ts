import { NextResponse } from "next/server";
import { generateApiKey, readDb, writeDb } from "@/lib/db";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.providerSettings);
}

export async function PUT(request: Request) {
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

  db.providerSettings = {
    ...db.providerSettings,
    ...payload,
    apiKey: db.providerSettings.apiKey,
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  return NextResponse.json(db.providerSettings);
}
