import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { event?: string; payload?: unknown };

  if (!body.event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  const db = await readDb();
  db.webhookLogs.unshift({
    id: crypto.randomUUID(),
    event: body.event,
    payload: JSON.stringify(body.payload ?? {}),
    receivedAt: new Date().toISOString(),
    status: "received"
  });

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
