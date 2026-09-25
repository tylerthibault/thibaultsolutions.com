import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { mediaAssets, projects } from "@/src/lib/schema";
import { effectStackSchema } from "@/src/lib/effects/registry";

const patchSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), effectStack: effectStackSchema.optional() });

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const rows = await db.select({ project: projects, asset: mediaAssets }).from(projects)
    .leftJoin(mediaAssets, eq(projects.assetId, mediaAssets.id))
    .where(and(eq(projects.id, id), eq(projects.ownerId, user.id))).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await ctx.params;
  const [row] = await db.update(projects).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, user.id))).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: row });
}
