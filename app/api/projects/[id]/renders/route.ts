import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { exportsTable, projects, renderJobs } from "@/src/lib/schema";
import { getBoss, RENDER_QUEUE } from "@/src/lib/queue";

const exportSchema = z.object({ resolution: z.enum(["source", "1080p", "720p"]), quality: z.enum(["high", "standard", "small"]), keepAudio: z.boolean() });

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser(request); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const jobs = await db.select().from(renderJobs).where(and(eq(renderJobs.projectId,id),eq(renderJobs.ownerId,user.id))).orderBy(desc(renderJobs.createdAt));
  const exports = await db.select().from(exportsTable).where(and(eq(exportsTable.projectId,id),eq(exportsTable.ownerId,user.id))).orderBy(desc(exportsTable.createdAt));
  return NextResponse.json({ jobs, exports });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser(request); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = exportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await ctx.params;
  const [project] = await db.select().from(projects).where(and(eq(projects.id,id),eq(projects.ownerId,user.id))).limit(1);
  if (!project?.assetId) return NextResponse.json({ error: "Project has no source video" }, { status: 409 });
  const [job] = await db.insert(renderJobs).values({ projectId:id, ownerId:user.id, ...parsed.data }).returning();
  const boss = await getBoss();
  const queueJobId = await boss.send(RENDER_QUEUE, { renderJobId: job.id }, { retryLimit: 1 });
  await db.update(renderJobs).set({ queueJobId: queueJobId ?? null, updatedAt: new Date() }).where(eq(renderJobs.id, job.id));
  return NextResponse.json({ job: { ...job, queueJobId } }, { status: 201 });
}
