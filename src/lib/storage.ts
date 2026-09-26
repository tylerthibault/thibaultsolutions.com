import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_STORAGE_PATH ?? "/data");
export type StorageArea = "uploads" | "renders" | "thumbnails" | "temp";

export async function ensureStorage() {
  await Promise.all((["uploads", "renders", "thumbnails", "temp"] as const).map((area) =>
    mkdir(path.join(/* turbopackIgnore: true */ root, area), { recursive: true })
  ));
}

export function storagePath(area: StorageArea, key: string) {
  const safe = path.basename(key);
  if (safe !== key) throw new Error("Invalid storage key");
  return path.join(/* turbopackIgnore: true */ root, area, safe);
}

export async function fileSize(area: StorageArea, key: string) {
  return (await stat(/* turbopackIgnore: true */ storagePath(area, key))).size;
}

export async function removeStored(area: StorageArea, key?: string | null) {
  if (!key) return;
  await unlink(/* turbopackIgnore: true */ storagePath(area, key)).catch(() => undefined);
}
