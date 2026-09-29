import { desc, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { db } from "./db";

export const ugcBrandLeads = pgTable("ugc_brand_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  brand: text("brand").notNull(),
  category: text("category").notNull().default("General"),
  signal: text("signal").notNull().default(""),
  source: text("source").notNull().default("Manual"),
  sourceUrl: text("source_url"),
  compensation: text("compensation").notNull().default("Not listed"),
  creatorFit: text("creator_fit").notNull().default(""),
  status: text("status").notNull().default("RESEARCH"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactUrl: text("contact_url"),
  pitchNotes: text("pitch_notes").notNull().default(""),
  researchNotes: text("research_notes").notNull().default(""),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  researchedAt: timestamp("researched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ugc_brand_status_idx").on(t.status, t.updatedAt),
  index("ugc_brand_follow_up_idx").on(t.nextFollowUpAt),
]);

let ensured = false;

export async function ensureUgcBrandCrm() {
  if (ensured) return;
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS "ugc_brand_leads" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "brand" text NOT NULL,
      "category" text DEFAULT 'General' NOT NULL,
      "signal" text DEFAULT '' NOT NULL,
      "source" text DEFAULT 'Manual' NOT NULL,
      "source_url" text,
      "compensation" text DEFAULT 'Not listed' NOT NULL,
      "creator_fit" text DEFAULT '' NOT NULL,
      "status" text DEFAULT 'RESEARCH' NOT NULL,
      "contact_name" text,
      "contact_email" text,
      "contact_url" text,
      "pitch_notes" text DEFAULT '' NOT NULL,
      "research_notes" text DEFAULT '' NOT NULL,
      "last_contacted_at" timestamptz,
      "next_follow_up_at" timestamptz,
      "researched_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "ugc_brand_status_idx" ON "ugc_brand_leads" ("status", "updated_at");
    CREATE INDEX IF NOT EXISTS "ugc_brand_follow_up_idx" ON "ugc_brand_leads" ("next_follow_up_at");
  `);

  const existing = await db.select({ id: ugcBrandLeads.id }).from(ugcBrandLeads).limit(1);
  if (existing.length === 0) {
    await db.insert(ugcBrandLeads).values([
      {
        brand: "SmashIt Honey",
        category: "Wellness / DTC",
        signal: "Actively seeking UGC creators for TikTok, Reels, and Meta ads",
        source: "Upwork creator brief",
        sourceUrl: "https://www.upwork.com/jobs/~022104871534896384007",
        compensation: "$20 listed",
        creatorFit: "Direct-response product demo / testimonial",
        status: "RESEARCH",
        researchNotes: "Open creator brief found Sept. 29, 2026. Review product, claims, deliverables, and usage-right terms before pitching.",
      },
      {
        brand: "Summers Ahead",
        category: "Financial services",
        signal: "Seeking natural-looking creators ages 28–55 for Facebook and Instagram ads",
        source: "Upwork creator brief",
        sourceUrl: "https://www.upwork.com/jobs/~022104698582123426682",
        compensation: "Not listed",
        creatorFit: "Talking-head testimonial / problem-solution",
        status: "RESEARCH",
        researchNotes: "Age range fits. Financial-services claims require extra care; verify brief language, substantiation, and required disclosures.",
      },
    ]);
  }
  ensured = true;
}

export async function listUgcBrandLeads() {
  await ensureUgcBrandCrm();
  return db.select().from(ugcBrandLeads).orderBy(desc(ugcBrandLeads.updatedAt));
}
