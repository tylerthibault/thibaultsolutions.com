import { desc } from "drizzle-orm";
import { db } from "./db";
import { ugcBrandLeads } from "./schema";

export async function listUgcBrandLeads() {
  return db.select().from(ugcBrandLeads).orderBy(desc(ugcBrandLeads.updatedAt));
}

export { ugcBrandLeads };
