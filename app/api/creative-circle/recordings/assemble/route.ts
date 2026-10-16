import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse } from "next/server";
import { apiUser } from "@/src/lib/api-auth";
import { ensureStorage, storagePath } from "@/src/lib/storage";
import { pruneQuickRecordingTemps, QUICK_RECORDING_TEMP_PREFIX } from "@/src/lib/quick-recording-storage";
import { assembleVariationVideo, normalizeVariationSegment } from "@/src/lib/variation-video";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CLIPS = 4;
const MAX_CLIP_BYTES = 60 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_CLIPS * MAX_CLIP_BYTES + 2 * 1024 * 1024;
const VIDEO_TYPES = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/x-m4v", ".m4v"],
  ["video/webm", ".webm"],
]);

// Successful exports are removed when streaming ends. The worker sweeps
// abandoned directories hourly once they reach 24 hours old.
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected video clips." }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Combined recordings are too large (240 MB maximum)." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Could not read the video upload." }, { status: 400 });
  const parts = form.getAll("clips");
  if (parts.length < 1 || parts.length > MAX_CLIPS || parts.some((part) => !(part instanceof File))) {
    return NextResponse.json({ error: "Send between one and four recorded video clips." }, { status: 400 });
  }

  let totalBytes = 0;
  const uploads = parts as File[];
  for (const part of uploads) {
    totalBytes += part.size;
    if (!part.size || part.size > MAX_CLIP_BYTES || totalBytes > MAX_CLIPS * MAX_CLIP_BYTES) {
      return NextResponse.json({ error: "A clip is empty or exceeds 60 MB, or the total exceeds 240 MB." }, { status: 413 });
    }
    if (!VIDEO_TYPES.has(part.type.split(";")[0].toLowerCase())) {
      return NextResponse.json({ error: "Unsupported recording format. Use MP4, MOV, M4V, or WebM." }, { status: 415 });
    }
  }

  await ensureStorage();
  await pruneQuickRecordingTemps().catch(() => undefined);
  const directory = storagePath("temp", QUICK_RECORDING_TEMP_PREFIX + randomUUID());
  await mkdir(directory);
  let handingOffStream = false;

  try {
    const prepared: string[] = [];
    for (const [index, part] of uploads.entries()) {
      const ext = VIDEO_TYPES.get(part.type.split(";")[0].toLowerCase())!;
      const incoming = path.join(directory, "source-" + index + ext);
      const normalized = path.join(directory, "clip-" + index + ".mp4");
      await pipeline(Readable.fromWeb(part.stream() as never), createWriteStream(incoming, { flags: "wx" }));
      await normalizeVariationSegment(incoming, normalized);
      prepared.push(normalized);
    }

    const output = path.join(directory, "finished.mp4");
    await assembleVariationVideo({
      inputs: prepared,
      output,
      concatListPath: path.join(directory, "combine.txt"),
      batchName: "Creative Circle Recording",
      uniqueId: randomUUID(),
    });

    const fileBytes = (await stat(output)).size;
    if (fileBytes < 1) throw new Error("Empty assembled recording");
    const stream = createReadStream(output);
    stream.once("close", () => {
      void rm(directory, { recursive: true, force: true }).catch(() => undefined);
    });
    handingOffStream = true;

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileBytes),
        "Content-Disposition": 'attachment; filename="creative-circle-recording.mp4"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Quick recording assembly failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The video could not be assembled. Your takes are still on this device; try again." }, { status: 422 });
  } finally {
    if (!handingOffStream) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
