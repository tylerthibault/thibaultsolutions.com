import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { renderJobs } from "@/src/lib/schema";
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser(request); if (!user) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const { id } = await ctx.params;
  const [job] = await db.select().from(renderJobs).where(and(eq(renderJobs.id,id),eq(renderJobs.ownerId,user.id))).limit(1);
  if (!job) return NextResponse.json({ error:"Not found" }, { status:404 });
  return NextResponse.json({ job });
}
