import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { projects } from "@/src/lib/schema";

const createSchema = z.object({ name: z.string().trim().min(1).max(120).default("Untitled Project") });

export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(projects).where(eq(projects.ownerId, user.id)).orderBy(desc(projects.updatedAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [project] = await db.insert(projects).values({ ownerId: user.id, name: parsed.data.name }).returning();
  return NextResponse.json({ project }, { status: 201 });
}
