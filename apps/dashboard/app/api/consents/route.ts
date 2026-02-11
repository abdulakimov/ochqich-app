import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { readDb, writeDb } from "@/lib/db";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.consentRequests);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { requestedAttributes?: string[] };

  if (!body.requestedAttributes?.length) {
    return NextResponse.json({ error: "requestedAttributes is required" }, { status: 400 });
  }

  const db = await readDb();

  db.consentRequests.unshift({
    id: crypto.randomUUID(),
    requestedAttributes: body.requestedAttributes,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
