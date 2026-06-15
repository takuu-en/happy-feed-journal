import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare("DELETE FROM entries WHERE id = ?").run(numericId);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
