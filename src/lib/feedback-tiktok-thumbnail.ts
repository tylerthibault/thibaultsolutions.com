import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseFeedbackLink, resolveFeedbackThumbnail } from "./feedback-links";
import { storagePath } from "./storage";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TRUSTED_IMAGE_HOSTS = [
  "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com",
  "muscdn.com", "byteimg.com", "ibyteimg.com", "tiktok.com",
];

export function isTrustedTikTokImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && !url.username && !url.password
      && (!url.port || url.port === "443")
      && TRUSTED_IMAGE_HOSTS.some((domain) => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

export function thumbnailImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp"
    && ["avif", "avis"].includes(Buffer.from(bytes.subarray(8, 12)).toString("ascii"))) return "image/avif";
  return null;
}

export function tiktokThumbnailCacheKey(videoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) throw new Error("Invalid feedback video ID");
  return "feedback-tiktok-" + videoId + ".image";
}

async function downloadImage(initialUrl: string): Promise<Uint8Array | null> {
  let url = initialUrl;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!isTrustedTikTokImageUrl(url)) return null;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        redirect: "manual",
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        const destination = response.headers.get("location");
        if (!destination) return null;
        url = new URL(destination, url).toString();
        continue;
      }
      if (!response.ok || !response.body) return null;
      const length = Number(response.headers.get("content-length"));
      if (length > MAX_IMAGE_BYTES) {
        await response.body.cancel();
        return null;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_IMAGE_BYTES) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks, size);
      return thumbnailImageType(bytes) ? bytes : null;
    }
  } catch {
    // If TikTok or its CDN is unavailable, the card will show a fallback.
  }
  return null;
}

export type CachedTikTokThumbnail = { bytes: Uint8Array; mimeType: string };

/** A stable local copy, so signed TikTok CDN URLs are never stored or served to browsers. */
export async function getTikTokThumbnail(videoId: string, sourceUrl: string): Promise<CachedTikTokThumbnail | null> {
  const key = tiktokThumbnailCacheKey(videoId);
  const file = storagePath("thumbnails", key);
  const saved = await readFile(file).catch(() => null);
  if (saved) {
    const mimeType = thumbnailImageType(saved);
    if (mimeType) return { bytes: saved, mimeType };
  }

  const link = parseFeedbackLink(sourceUrl);
  if (!link || link.provider !== "tiktok") return null;
  const url = await resolveFeedbackThumbnail(link);
  if (!url || !isTrustedTikTokImageUrl(url)) return null;
  const bytes = await downloadImage(url);
  if (!bytes) return null;
  const mimeType = thumbnailImageType(bytes);
  if (!mimeType) return null;

  const temp = storagePath("thumbnails", key + "." + randomUUID() + ".tmp");
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temp, bytes);
    await rename(temp, file);
  } catch {
    // Readable even if storage cannot be written; a later request can retry caching.
  } finally {
    await unlink(temp).catch(() => undefined);
  }
  return { bytes, mimeType };
}
