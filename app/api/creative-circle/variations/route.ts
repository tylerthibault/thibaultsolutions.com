import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { variationSessions } from "@/src/lib/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await db.select()
    .from(variationSessions)
    .where(eq(variationSessions.ownerId, user.id))
    .orderBy(desc(variationSessions.updatedAt))
    .limit(20);

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const [session] = await db.insert(variationSessions).values({
    ownerId: user.id,
    name: name || `Variation batch ${new Date().toLocaleDateString("en-US")}`,
  }).returning();

  return NextResponse.json({ session }, { status: 201 });
}
