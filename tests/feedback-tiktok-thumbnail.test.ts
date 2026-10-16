import { describe, expect, it } from "vitest";
import {
  isTrustedTikTokImageUrl,
  thumbnailImageType,
  tiktokThumbnailCacheKey,
} from "../src/lib/feedback-tiktok-thumbnail";

describe("TikTok thumbnail security", () => {
  it.each([
    "https://p16-sign-va.tiktokcdn.com/path?x-expires=123",
    "https://p16-sign-va.tiktokcdn-us.com/path",
    "https://p16.muscdn.com/obj/example",
    "https://p16.byteimg.com/example",
  ])("accepts a trusted HTTPS thumbnail host: %s", (url) => {
    expect(isTrustedTikTokImageUrl(url)).toBe(true);
  });

  it.each([
    "http://p16.muscdn.com/image",
    "https://tiktokcdn.com.evil.example/image",
    "https://localhost/internal",
    "https://127.0.0.1/private",
    "https://user:secret@p16.muscdn.com/image",
    "https://p16.muscdn.com:8443/image",
    "file:///etc/passwd",
  ])("rejects unsafe thumbnail URL: %s", (url) => {
    expect(isTrustedTikTokImageUrl(url)).toBe(false);
  });

  it("recognizes actual image bytes instead of trusting content-type", () => {
    expect(thumbnailImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]))).toBe("image/jpeg");
    expect(thumbnailImageType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(thumbnailImageType(Buffer.from("RIFF1234WEBP"))).toBe("image/webp");
    expect(thumbnailImageType(Buffer.from("<html>denied</html>"))).toBeNull();
  });

  it("uses safe stable cache filenames", () => {
    const id = "80f63717-8032-4bac-8667-a5bce14604da";
    expect(tiktokThumbnailCacheKey(id)).toBe("feedback-tiktok-" + id + ".image");
    expect(() => tiktokThumbnailCacheKey("../../etc/passwd")).toThrow();
  });
});
