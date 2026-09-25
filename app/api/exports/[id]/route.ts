import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { exportsTable } from "@/src/lib/schema";
import { removeStored, storagePath } from "@/src/lib/storage";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab"); if (!user) return new Response("Unauthorized",{status:401});
  const { id } = await ctx.params;
  const [row] = await db.select().from(exportsTable).where(and(eq(exportsTable.id,id),eq(exportsTable.ownerId,user.id))).limit(1);
  if (!row) return new Response("Not found",{status:404});
  const file=storagePath("renders",row.storageKey); const info=await stat(file);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream,{headers:{"Content-Type":"video/mp4","Content-Length":String(info.size),"Content-Disposition":`attachment; filename="creative-circle-${id}.mp4"`,"Cache-Control":"private, no-store"}});
}
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab"); if (!user) return new Response("Unauthorized",{status:401});
  const { id } = await ctx.params;
  const [row] = await db.delete(exportsTable).where(and(eq(exportsTable.id,id),eq(exportsTable.ownerId,user.id))).returning();
  if (!row) return new Response("Not found",{status:404});
  await removeStored("renders",row.storageKey);
  return new Response(null,{status:204});
}
