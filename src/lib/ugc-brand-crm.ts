import { desc } from "drizzle-orm";
import { db } from "./db";
import { ugcBrandLeads } from "./schema";

let seeded = false;

export async function ensureUgcBrandCrm() {
  if (seeded) return;

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

  seeded = true;
}

export async function listUgcBrandLeads() {
  await ensureUgcBrandCrm();
  return db.select().from(ugcBrandLeads).orderBy(desc(ugcBrandLeads.updatedAt));
}

export { ugcBrandLeads };
