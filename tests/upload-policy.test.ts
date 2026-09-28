import { describe, expect, it } from "vitest";
import { validateUploadHeaders } from "../src/lib/upload-policy";
describe("upload validation",()=>{it("accepts supported video types",()=>expect(validateUploadHeaders("video/mp4","clip.mp4",100,1000).ok).toBe(true));it("rejects extension mismatch",()=>expect(validateUploadHeaders("video/mp4","clip.exe",100,1000).ok).toBe(false));it("rejects oversized uploads",()=>expect(validateUploadHeaders("video/mp4","clip.mp4",2000,1000).ok).toBe(false))});
