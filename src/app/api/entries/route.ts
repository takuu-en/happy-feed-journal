import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { FeedEntry, FeedKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_KINDS: FeedKind[] = ["breast", "bottle", "solid", "snack"];

export async function GET() {
  const db = getDb();
  const entries = db
    .prepare("SELECT * FROM entries ORDER BY fed_at DESC, id DESC")
    .all() as FeedEntry[];
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const babyName = String(body.baby_name ?? "").trim();
  const kind = String(body.kind ?? "") as FeedKind;

  if (!babyName) {
    return NextResponse.json(
      { error: "baby_name is required" },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${VALID_KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const fedAt = body.fed_at ? new Date(String(body.fed_at)).toISOString() : now;

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO entries (baby_name, kind, food, amount, mood, notes, fed_at, created_at)
       VALUES (@baby_name, @kind, @food, @amount, @mood, @notes, @fed_at, @created_at)`,
    )
    .run({
      baby_name: babyName,
      kind,
      food: String(body.food ?? "").trim(),
      amount: String(body.amount ?? "").trim(),
      mood: String(body.mood ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
      fed_at: fedAt,
      created_at: now,
    });

  const entry = db
    .prepare("SELECT * FROM entries WHERE id = ?")
    .get(result.lastInsertRowid) as FeedEntry;

  return NextResponse.json({ entry }, { status: 201 });
}
