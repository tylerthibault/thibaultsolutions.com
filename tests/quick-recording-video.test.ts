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
  it.skipIf(!ffmpegReady)("preserves legacy 720p / 30 FPS behavior in Variation Studio", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "creative-circle-legacy-"));
    try {
      const input = path.join(directory, "input.mp4");
      const output = path.join(directory, "output.mp4");
      const ffmpeg = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc2=s=360x640:r=30:d=0.35",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=0.35",
        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-y", input,
      ], { encoding: "utf8" });
      expect(ffmpeg.status, ffmpeg.stderr).toBe(0);
      const metadata = await normalizeVariationSegment(input, output);
      expect(metadata).toMatchObject({ width: 720, height: 1280, codec: "h264", hasAudio: true, frameRate: "30/1" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);

  it.skipIf(!ffmpegReady)("joins two real 60 FPS clips as a 1080x1920 H.264/AAC MP4", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "creative-circle-v61-"));
    try {
      const prepared: string[] = [];
      for (const [index, frequency] of [440, 660].entries()) {
        const input = path.join(directory, "source-" + index + ".mp4");
        const output = path.join(directory, "normalized-" + index + ".mp4");
        const ffmpeg = spawnSync("ffmpeg", [
          "-hide_banner", "-loglevel", "error",
          "-f", "lavfi", "-i", "testsrc2=s=540x960:r=60:d=0.4",
          "-f", "lavfi", "-i", "sine=frequency=" + frequency + ":duration=0.4",
          "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-y", input,
        ], { encoding: "utf8" });
        expect(ffmpeg.status, ffmpeg.stderr).toBe(0);
        const sourceMeta = await probeVideo(input);
        expect(sourceMeta.frameRate).toBe("60/1");
        const encoded = await normalizeVariationSegment(input, output, {
          width: 1080,
          height: 1920,
          frameRate: 60,
          qualityCrf: 18,
          audioBitrate: "192k",
          fillPortrait: true,
        });
        expect(encoded).toMatchObject({ width: 1080, height: 1920, frameRate: "60/1", codec: "h264", hasAudio: true });
        prepared.push(output);
      }

      const finished = path.join(directory, "finished.mp4");
      await assembleVariationVideo({
        inputs: prepared,
        output: finished,
        concatListPath: path.join(directory, "concat.txt"),
        batchName: "V6.1 CapCut export",
        uniqueId: "capcut-smoke-test",
      });
      const info = await probeVideo(finished);
      expect(info).toMatchObject({ width: 1080, height: 1920, frameRate: "60/1", codec: "h264", hasAudio: true });
      expect(info.durationMs).toBeGreaterThan(650);
      expect(info.durationMs).toBeLessThan(1100);

      const probe = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", finished], { encoding: "utf8" });
      expect(probe.status, probe.stderr).toBe(0);
      const streams = JSON.parse(probe.stdout) as { streams: Array<Record<string, unknown>> };
      const v = streams.streams.find((s) => s.codec_type === "video");
      const a = streams.streams.find((s) => s.codec_type === "audio");
      expect(v).toMatchObject({ codec_name: "h264", pix_fmt: "yuv420p" });
      expect(a).toMatchObject({ codec_name: "aac", sample_rate: "48000", channels: 2 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
