import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = (await request.json()) as { status?: "pending" | "approved" | "rejected" };

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const db = await readDb();
  const target = db.consentRequests.find((item) => item.id === params.id);

  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  target.status = body.status;
  await writeDb(db);

  return NextResponse.json({ ok: true });
}
