import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { getFfmpegPath, probeVideo } from "./video";

export const variationKinds = ["hook", "body", "cta"] as const;
export type VariationKind = typeof variationKinds[number];

export type VariationSegmentInput = {
  position: number;
  storageKey: string;
  durationMs: number;
};

export function isVariationKind(value: string | null): value is VariationKind {
  return Boolean(value && variationKinds.includes(value as VariationKind));
}

export function buildVariationCombinations(segments: Array<VariationSegmentInput & { kind: VariationKind }>) {
  const hooks = segments.filter((segment) => segment.kind === "hook").sort((a, b) => a.position - b.position);
  const bodies = segments.filter((segment) => segment.kind === "body").sort((a, b) => a.position - b.position);
  const ctas = segments.filter((segment) => segment.kind === "cta").sort((a, b) => a.position - b.position);

  return hooks.flatMap((hook) =>
    bodies.flatMap((body) =>
      ctas.map((cta) => ({
        hook,
        body,
        cta,
        durationMs: hook.durationMs + body.durationMs + cta.durationMs,
      }))
    )
  );
}

function runFfmpeg(args: string[], timeoutMs = 15 * 60 * 1000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
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
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2200)}`));
    });
  });
}

export async function normalizeVariationSegment(input: string, output: string) {
  const source = await probeVideo(input);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", input];

  if (!source.hasAudio) {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  args.push(
    "-map", "0:v:0",
    "-map", source.hasAudio ? "0:a:0" : "1:a:0",
    "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "21",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "48000",
    "-ac", "2",
  );

  if (source.hasAudio) {
    args.push("-af", "apad", "-shortest");
  } else {
    args.push("-shortest");
  }

  args.push("-movflags", "+faststart", output);
  await runFfmpeg(args);
  return probeVideo(output);
}

function quoteConcatPath(value: string) {
  return value.replace(/'/g, "'\\''");
}

export async function assembleVariationVideo(options: {
  inputs: string[];
  output: string;
  concatListPath: string;
  batchName: string;
  uniqueId: string;
}) {
  const { inputs, output, concatListPath, batchName, uniqueId } = options;
  const list = inputs.map((input) => `file '${quoteConcatPath(input)}'`).join("\n");
  await writeFile(concatListPath, `${list}\n`, "utf8");

  try {
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-map", "0:v:0",
      "-map", "0:a:0",
      "-c", "copy",
      "-map_metadata", "-1",
      "-metadata", `title=${batchName}`,
      "-metadata", `comment=Creative Circle variation ${uniqueId}`,
      "-metadata", `creation_time=${new Date().toISOString()}`,
      "-movflags", "+faststart",
      output,
    ], 5 * 60 * 1000);
  } finally {
    await unlink(concatListPath).catch(() => undefined);
  }
}

export function variationFileName(batchName: string, hook: number, body: number, cta: number, id: string) {
  const slug = batchName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "creative-circle";
  return `${slug}-h${hook}-b${body}-c${cta}-${id.slice(0, 8)}.mp4`;
}
