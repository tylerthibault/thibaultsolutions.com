import { describe, expect, it } from "vitest";
import { detectUgcDiscoverySourceType } from "@/src/lib/ugc-discovery";

describe("UGC discovery source detection", () => {
  it("detects Greenhouse boards", () => {
    expect(detectUgcDiscoverySourceType("https://boards.greenhouse.io/example")).toBe("GREENHOUSE");
    expect(detectUgcDiscoverySourceType("https://job-boards.greenhouse.io/example")).toBe("GREENHOUSE");
  });

  it("detects Lever boards", () => {
    expect(detectUgcDiscoverySourceType("https://jobs.lever.co/example")).toBe("LEVER");
  });

  it("falls back to generic careers pages", () => {
    expect(detectUgcDiscoverySourceType("https://example.com/careers")).toBe("GENERIC");
  });
});
