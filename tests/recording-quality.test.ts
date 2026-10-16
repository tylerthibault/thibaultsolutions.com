import { describe, expect, it } from "vitest";
import { commonExportFrameRate, parseRecordingFrameRate } from "../src/lib/recording-quality";

describe("CapCut-compatible MP4 quality selection", () => {
  it("accepts only supported recording frame rates", () => {
    expect(parseRecordingFrameRate("30")).toBe(30);
    expect(parseRecordingFrameRate("60")).toBe(60);
    expect(parseRecordingFrameRate("120")).toBeNull();
    expect(parseRecordingFrameRate(null)).toBeNull();
  });

  it("exports real 60 FPS only if all source clips average at least 50 FPS", () => {
    expect(commonExportFrameRate(60, ["60/1", "60000/1001"])).toBe(60);
    expect(commonExportFrameRate(60, ["60/1", "30/1"])).toBe(30);
    expect(commonExportFrameRate(60, ["0/0"])).toBe(30);
    expect(commonExportFrameRate(60, [])).toBe(30);
    expect(commonExportFrameRate(30, ["60/1"])).toBe(30);
  });
});
