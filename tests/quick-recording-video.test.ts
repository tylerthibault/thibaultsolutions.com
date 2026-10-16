import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleVariationVideo, normalizeVariationSegment } from "../src/lib/variation-video";
import { probeVideo } from "../src/lib/video";

const ffmpegReady = ["ffmpeg", "ffprobe"].every((command) =>
  spawnSync(command, ["-version"], { stdio: "ignore" }).status === 0
);

describe("V6.1 one-video MP4 assembly", () => {
  it.skipIf(!ffmpegReady)("joins four different takes in their recorded order into a portrait H.264/AAC file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "creative-circle-v61-"));
    try {
      const prepared: string[] = [];
      for (const [index, color] of ["blue", "red", "green", "yellow"].entries()) {
        const input = path.join(directory, "source-" + index + ".mp4");
        const output = path.join(directory, "normalized-" + index + ".mp4");
        const ffmpeg = spawnSync("ffmpeg", [
          "-hide_banner", "-loglevel", "error",
          "-f", "lavfi", "-i", "color=c=" + color + ":s=360x640:r=30:d=0.35",
          "-f", "lavfi", "-i", "sine=frequency=" + (420 + 90 * index) + ":duration=0.35",
          "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-y", input,
        ], { encoding: "utf8" });
        expect(ffmpeg.status, ffmpeg.stderr).toBe(0);
        await normalizeVariationSegment(input, output);
        prepared.push(output);
      }

      const finished = path.join(directory, "finished.mp4");
      await assembleVariationVideo({
        inputs: prepared,
        output: finished,
        concatListPath: path.join(directory, "concat.txt"),
        batchName: "V6.1 test",
        uniqueId: "recording-smoke-test",
      });

      const metadata = await probeVideo(finished);
      expect(metadata).toMatchObject({
        width: 720,
        height: 1280,
        codec: "h264",
        hasAudio: true,
      });
      expect(metadata.durationMs).toBeGreaterThan(1100);
      expect(metadata.durationMs).toBeLessThan(2200);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
