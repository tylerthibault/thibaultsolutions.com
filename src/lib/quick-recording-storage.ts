import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { storagePath } from "./storage.js";

export const QUICK_RECORDING_TEMP_PREFIX = "quick-recording-";
export const QUICK_RECORDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Delete only expired quick-recording work directories. Other temporary
 * storage, including Variation Studio files, must remain untouched.
 */
export async function pruneQuickRecordingTemps(
  directory = storagePath("temp", "."),
  now = Date.now(),
) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(QUICK_RECORDING_TEMP_PREFIX))
    .map(async (entry) => {
      const target = path.join(directory, entry.name);
      const info = await stat(target).catch(() => null);
      if (info && now - info.mtimeMs >= QUICK_RECORDING_MAX_AGE_MS) {
        await rm(target, { recursive: true, force: true });
      }
    }));
}
