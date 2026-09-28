import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { ensureStorage } from "@/src/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureStorage();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
