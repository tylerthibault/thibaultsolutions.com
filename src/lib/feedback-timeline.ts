import { spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { ensureStorage, storagePath } from "./storage";
import { getFfmpegPath } from "./video";

export type FeedbackTimelineManifest = {
  durationMs: number;
  waveform: number[];
  frames: Array<{ index: number; timeMs: number }>;
};

const globalTimeline = globalThis as unknown as {
  feedbackTimelineJobs?: Map<string, Promise<FeedbackTimelineManifest>>;
};

const jobs = globalTimeline.feedbackTimelineJobs ?? new Map<string, Promise<FeedbackTimelineManifest>>();
if (!globalTimeline.feedbackTimelineJobs) globalTimeline.feedbackTimelineJobs = jobs;

function manifestPath(assetId: string) {
  return storagePath("renders", `${assetId}.feedback-timeline.json`);
}

export function feedbackTimelineFramePath(assetId: string, index: number) {
  return storagePath("renders", `${assetId}.feedback-frame-${String(index).padStart(2, "0")}.jpg`);
}

async function existingManifest(assetId: string) {
  try {
    const raw = await readFile(manifestPath(assetId), "utf8");
    const parsed = JSON.parse(raw) as FeedbackTimelineManifest;
    if (!Array.isArray(parsed.frames) || !Array.isArray(parsed.waveform)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function runFfmpeg(args: string[], binary = false, timeoutMs = 120_000) {
  return new Promise<Buffer | string>((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("Timeline generation timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim().split("\n").slice(-4).join(" ") || `ffmpeg exited with ${code}`));
        return;
      }
      const output = Buffer.concat(stdout);
      resolve(binary ? output : output.toString());
    });
  });
}

async function waveformFor(input: string, bins = 180) {
  try {
    const raw = await runFfmpeg([
      "-v", "error",
      "-i", input,
      "-map", "0:a:0",
      "-vn",
      "-ac", "1",
      "-ar", "4000",
      "-f", "s16le",
      "pipe:1",
    ], true) as Buffer;

    const sampleCount = Math.floor(raw.length / 2);
    if (!sampleCount) return [];

    const bucketSize = Math.max(1, Math.ceil(sampleCount / bins));
    const values: number[] = [];
    let globalMax = 0;

    for (let start = 0; start < sampleCount; start += bucketSize) {
      const end = Math.min(sampleCount, start + bucketSize);
      let peak = 0;
      for (let i = start; i < end; i += 1) {
        const value = Math.abs(raw.readInt16LE(i * 2)) / 32768;
        if (value > peak) peak = value;
      }
      globalMax = Math.max(globalMax, peak);
      values.push(peak);
    }

    const normalizer = globalMax > 0 ? globalMax : 1;
    return values.map((value) => Math.round((value / normalizer) * 1000) / 1000);
  } catch {
    return [];
  }
}

async function generate(assetId: string, input: string, durationMs: number) {
  await ensureStorage();
  const frameCount = 8;
  const safeDuration = Math.max(500, durationMs);
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const timeMs = Math.min(safeDuration - 100, Math.max(0, Math.round(safeDuration * ((index + 0.5) / frameCount))));
    return { index, timeMs };
  });

  for (const frame of frames) {
    const output = feedbackTimelineFramePath(assetId, frame.index);
    const exists = await stat(output).then((info) => info.isFile() && info.size > 0).catch(() => false);
    if (exists) continue;

    await runFfmpeg([
      "-v", "error",
      "-ss", (frame.timeMs / 1000).toFixed(3),
      "-i", input,
      "-frames:v", "1",
      "-vf", "scale='min(360,iw)':-2",
      "-q:v", "5",
      "-y",
      output,
    ]);
  }

  const waveform = await waveformFor(input);
  const manifest: FeedbackTimelineManifest = { durationMs: safeDuration, waveform, frames };
  await writeFile(manifestPath(assetId), JSON.stringify(manifest), "utf8");
  return manifest;
}

export async function getFeedbackTimeline(assetId: string, input: string, durationMs: number) {
  const existing = await existingManifest(assetId);
  if (existing && existing.durationMs === Math.max(500, durationMs)) return existing;

  const running = jobs.get(assetId);
  if (running) return running;

  const job = generate(assetId, input, durationMs).finally(() => jobs.delete(assetId));
  jobs.set(assetId, job);
  return job;
}
