import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { listUgcBrandLeads, ugcBrandLeads } from "@/src/lib/ugc-brand-crm";
import { UGC_BRAND_STATUSES } from "@/src/lib/ugc-brand-types";

const createSchema = z.object({
  brand: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).default("General"),
  signal: z.string().trim().max(1000).default(""),
  source: z.string().trim().max(160).default("Manual"),
  sourceUrl: z.string().trim().url().or(z.literal("")).optional(),
  compensation: z.string().trim().max(160).default("Not listed"),
  creatorFit: z.string().trim().max(600).default(""),
  status: z.enum(UGC_BRAND_STATUSES).default("RESEARCH"),
  contactName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().email().or(z.literal("")).optional(),
  contactUrl: z.string().trim().url().or(z.literal("")).optional(),
  pitchNotes: z.string().trim().max(4000).default(""),
  researchNotes: z.string().trim().max(4000).default(""),
  lastContactedAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
});

async function requireAdmin(request: Request) {
  const user = await apiSessionUser(request);
  return user && isCreativeCircleAdmin(user.email) ? user : null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leads = await listUgcBrandLeads();
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const [duplicate] = await db.select({ id: ugcBrandLeads.id }).from(ugcBrandLeads)
    .where(sql`lower(${ugcBrandLeads.brand}) = lower(${data.brand})`).limit(1);
  if (duplicate) return NextResponse.json({ error: "That brand is already in the radar" }, { status: 409 });

  const {
    sourceUrl,
    contactName,
    contactEmail,
    contactUrl,
    lastContactedAt,
    nextFollowUpAt,
    ...rest
  } = data;

  const [lead] = await db.insert(ugcBrandLeads).values({
    ...rest,
    sourceUrl: sourceUrl || null,
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    contactUrl: contactUrl || null,
    lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null,
    nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    researchedAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  return NextResponse.json({ lead }, { status: 201 });
}
