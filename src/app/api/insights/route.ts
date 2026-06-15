import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { computeInsights } from "@/lib/insights";
import type { FeedEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const entries = db
    .prepare("SELECT * FROM entries ORDER BY fed_at DESC, id DESC")
    .all() as FeedEntry[];

  const insights = await computeInsights(entries);
  return NextResponse.json({ insights });
}
