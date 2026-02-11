import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { sessionCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { providerName?: string; apiKey?: string };
  const db = await readDb();

  if (!body.providerName || !body.apiKey) {
    return NextResponse.json({ error: "providerName and apiKey are required" }, { status: 400 });
  }

  const providerMatches = body.providerName === db.providerSettings.name;
  const keyMatches = body.apiKey === db.providerSettings.apiKey;

  if (!providerMatches || !keyMatches) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "active", { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}
