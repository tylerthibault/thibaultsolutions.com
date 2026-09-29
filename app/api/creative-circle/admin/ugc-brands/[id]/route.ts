import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiCreativeCircleAdmin } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { ugcBrandLeads } from "@/src/lib/ugc-brand-crm";
import { UGC_BRAND_STATUSES } from "@/src/lib/ugc-brand-types";

const patchSchema = z.object({
  brand: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(120).optional(),
  signal: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(160).optional(),
  sourceUrl: z.string().trim().url().or(z.literal("")).nullable().optional(),
  compensation: z.string().trim().max(160).optional(),
  creatorFit: z.string().trim().max(600).optional(),
  status: z.enum(UGC_BRAND_STATUSES).optional(),
  contactName: z.string().trim().max(160).nullable().optional(),
  contactEmail: z.string().trim().email().or(z.literal("")).nullable().optional(),
  contactUrl: z.string().trim().url().or(z.literal("")).nullable().optional(),
  pitchNotes: z.string().trim().max(4000).optional(),
  researchNotes: z.string().trim().max(4000).optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const researchTouched = ["signal", "source", "sourceUrl", "compensation", "creatorFit", "researchNotes"]
    .some((key) => key in data);
  const closingLead = data.status === "WON" || data.status === "PASS";
  const {
    sourceUrl,
    contactName,
    contactEmail,
    contactUrl,
    lastContactedAt,
    nextFollowUpAt,
    ...rest
  } = data;

  const values = {
    ...rest,
    ...(sourceUrl !== undefined ? { sourceUrl: sourceUrl || null } : {}),
    ...(contactName !== undefined ? { contactName: contactName || null } : {}),
    ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
    ...(contactUrl !== undefined ? { contactUrl: contactUrl || null } : {}),
    ...(lastContactedAt !== undefined ? { lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null } : {}),
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null } : {}),
    ...(closingLead && nextFollowUpAt === undefined ? { nextFollowUpAt: null } : {}),
    ...(researchTouched ? { researchedAt: new Date() } : {}),
    updatedAt: new Date(),
  };
  const [lead] = await db.update(ugcBrandLeads).set(values).where(eq(ugcBrandLeads.id, id)).returning();
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const [deleted] = await db.delete(ugcBrandLeads).where(eq(ugcBrandLeads.id, id)).returning({ id: ugcBrandLeads.id });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
