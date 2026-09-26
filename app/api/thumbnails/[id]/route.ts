import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { mediaAssets } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){const user=await apiSectionUser(request, "lab");if(!user)return new Response("Unauthorized",{status:401});const{id}=await ctx.params;const[a]=await db.select().from(mediaAssets).where(and(eq(mediaAssets.id,id),eq(mediaAssets.ownerId,user.id))).limit(1);if(!a?.thumbnailKey)return new Response("Not found",{status:404});return new Response(Readable.toWeb(createReadStream(storagePath("thumbnails",a.thumbnailKey))) as ReadableStream,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, max-age=3600"}})}
