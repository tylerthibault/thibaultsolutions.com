import { mkdtemp, mkdir, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pruneQuickRecordingTemps, QUICK_RECORDING_MAX_AGE_MS } from "../src/lib/quick-recording-storage";

describe("V6.1 temporary video cleanup", () => {
  it("removes abandoned recordings after 24 hours without touching fresh or unrelated files", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "v61-temp-"));
    const now = Date.now();
    try {
      for (const name of ["quick-recording-expired", "quick-recording-active", "other-project"]) {
        await mkdir(path.join(directory, name));
      }
      const old = new Date(now - QUICK_RECORDING_MAX_AGE_MS - 60_000);
      await utimes(path.join(directory, "quick-recording-expired"), old, old);
      await pruneQuickRecordingTemps(directory, now);
      expect((await readdir(directory)).sort()).toEqual(["other-project", "quick-recording-active"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
