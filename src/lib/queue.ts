import { PgBoss } from "pg-boss";
const globalBoss = globalThis as unknown as { creativeBoss?: PgBoss; bossStart?: Promise<PgBoss> };
export const RENDER_QUEUE = "creative-circle-render";
export async function getBoss() {
  if (globalBoss.bossStart) return globalBoss.bossStart;
  globalBoss.bossStart = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    const boss = globalBoss.creativeBoss ?? new PgBoss(url);
    boss.on("error", (error) => console.error("pg-boss", error));
    await boss.start();
    await boss.createQueue(RENDER_QUEUE).catch((error) => {
      if (!/exist/i.test(String(error))) throw error;
    });
    globalBoss.creativeBoss = boss;
    return boss;
  })();
  return globalBoss.bossStart;
}
