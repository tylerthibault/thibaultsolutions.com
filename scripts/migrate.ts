import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required to run database migrations");

const migrationsFolder = process.env.DB_MIGRATIONS_PATH ?? "./drizzle";
const maxAttempts = Number(process.env.DB_MIGRATION_MAX_ATTEMPTS ?? "30");
const retryDelayMs = Number(process.env.DB_MIGRATION_RETRY_DELAY_MS ?? "2000");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let completed = false;
let lastError: unknown;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const pool = new Pool({ connectionString: url });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("Database migrations are up to date.");
    completed = true;
    await pool.end();
    break;
  } catch (error) {
    lastError = error;
    await pool.end().catch(() => undefined);

    if (attempt >= maxAttempts) break;

    console.warn(
      `Database migration attempt ${attempt}/${maxAttempts} failed; retrying in ${retryDelayMs}ms.`,
    );
    await sleep(retryDelayMs);
  }
}

if (!completed) {
  throw lastError instanceof Error ? lastError : new Error("Database migrations failed");
}
