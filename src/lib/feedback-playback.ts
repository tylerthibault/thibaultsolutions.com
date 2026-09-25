import { randomUUID } from "node:crypto";
import { rename, stat, unlink } from "node:fs/promises";
import { ensureStorage, storagePath } from "./storage";
import { makeBrowserPlaybackCopy } from "./video";

export type FeedbackPlaybackAsset = {
  id: string;
  storageKey: string;
  mimeType: string;
  codec: string;
};

export type FeedbackPlaybackStatus =
  | "ready"
  | "needs_preparation"
  | "processing"
  | "missing"
  | "error";

export type FeedbackPlaybackState = {
  status: FeedbackPlaybackStatus;
  file?: string;
  prepared?: boolean;
  detail?: string;
};

const globalPlayback = globalThis as unknown as {
  feedbackPlaybackJobs?: Map<string, Promise<void>>;
  feedbackPlaybackErrors?: Map<string, string>;
};

const jobs = globalPlayback.feedbackPlaybackJobs ?? new Map<string, Promise<void>>();
const errors = globalPlayback.feedbackPlaybackErrors ?? new Map<string, string>();

if (!globalPlayback.feedbackPlaybackJobs) globalPlayback.feedbackPlaybackJobs = jobs;
if (!globalPlayback.feedbackPlaybackErrors) globalPlayback.feedbackPlaybackErrors = errors;

function sourcePath(asset: FeedbackPlaybackAsset) {
  return storagePath("uploads", asset.storageKey);
}

function preparedPath(asset: FeedbackPlaybackAsset) {
  return storagePath("renders", `${asset.id}.feedback-browser.mp4`);
}

async function fileExists(file: string) {
  const info = await stat(file).catch(() => null);
  return Boolean(info && info.isFile() && info.size > 0);
}

function isBrowserSafe(asset: FeedbackPlaybackAsset) {
  return asset.mimeType.toLowerCase() === "video/mp4" && asset.codec.toLowerCase() === "h264";
}

export async function getFeedbackPlaybackState(asset: FeedbackPlaybackAsset): Promise<FeedbackPlaybackState> {
  const source = sourcePath(asset);
  if (!(await fileExists(source))) {
    return {
      status: "missing",
      detail: "The uploaded video file is missing from server storage.",
    };
  }

  if (isBrowserSafe(asset)) {
    return { status: "ready", file: source, prepared: false };
  }

  const prepared = preparedPath(asset);
  if (await fileExists(prepared)) {
    errors.delete(asset.id);
    return { status: "ready", file: prepared, prepared: true };
  }

  if (jobs.has(asset.id)) return { status: "processing" };

  const error = errors.get(asset.id);
  if (error) return { status: "error", detail: error };

  return { status: "needs_preparation" };
}

export async function startFeedbackPlaybackPreparation(asset: FeedbackPlaybackAsset): Promise<FeedbackPlaybackState> {
  const current = await getFeedbackPlaybackState(asset);
  if (current.status !== "needs_preparation" && current.status !== "error") return current;

  errors.delete(asset.id);
  await ensureStorage();

  const source = sourcePath(asset);
  const target = preparedPath(asset);
  const temp = storagePath("temp", `${asset.id}.${randomUUID()}.feedback-browser.mp4`);

  const job = (async () => {
    try {
      await makeBrowserPlaybackCopy(source, temp, asset.codec);
      await rename(temp, target);
      errors.delete(asset.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown FFmpeg error";
      errors.set(asset.id, detail);
      console.error("Feedback Lab playback preparation failed", {
        assetId: asset.id,
        codec: asset.codec,
        mimeType: asset.mimeType,
        detail,
      });
    } finally {
      await unlink(temp).catch(() => undefined);
      jobs.delete(asset.id);
    }
  })();

  jobs.set(asset.id, job);
  return { status: "processing" };
}
