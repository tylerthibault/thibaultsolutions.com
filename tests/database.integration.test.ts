import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { projects, user } from "../src/lib/schema";
const enabled=Boolean(process.env.DATABASE_URL);const suite=enabled?describe:describe.skip;const pool=enabled?new Pool({connectionString:process.env.DATABASE_URL}):null;const db=pool?drizzle(pool):null;const uid=`test-${Date.now()}`;
suite("database persistence",()=>{beforeAll(async()=>{await db!.insert(user).values({id:uid,name:"Test",email:`${uid}@example.test`})});afterAll(async()=>{await db!.delete(user).where(eq(user.id,uid));await pool!.end()});it("persists an ordered effect stack",async()=>{const stack=[{instanceId:"a",effectId:"neon-edge-trace",enabled:true,seed:10,params:{glow:7}},{instanceId:"b",effectId:"film-gate-flicker",enabled:true,seed:20,params:{grain:.2}}];const[p]=await db!.insert(projects).values({ownerId:uid,name:"Persistence Test",effectStack:stack}).returning();const[loaded]=await db!.select().from(projects).where(eq(projects.id,p.id));expect(loaded.effectStack.map(x=>x.effectId)).toEqual(["neon-edge-trace","film-gate-flicker"]);await db!.delete(projects).where(eq(projects.id,p.id))})});
