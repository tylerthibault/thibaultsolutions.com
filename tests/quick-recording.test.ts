import { describe, expect, it } from "vitest";
import { parseQuickRecordingScript } from "../src/lib/quick-recording";

describe("V6.1 single-video recording script", () => {
  it("records an untagged script as one complete take", () => {
    expect(parseQuickRecordingScript("Just talk naturally.")).toEqual({
      ok: true, clips: [{ id: "full", label: "Full video", script: "Just talk naturally." }],
    });
  });

  it("allows an empty script for unscripted recording", () => {
    expect(parseQuickRecordingScript("")).toEqual({
      ok: true, clips: [{ id: "full", label: "Full video", script: "" }],
    });
  });

  it("cues hook, body one, body two, and CTA in film order without recording beat markers", () => {
    const input = [
      "[[BODY 2]]", "[[BEAT 1]]", "Second point.", "[[BEAT 2]]", "Another point.",
      "[[HOOK]]", "Opening.", "[[CTA]]", "Follow along.",
      "[[BODY 1]]", "First point.",
    ].join("\n");
    expect(parseQuickRecordingScript(input)).toEqual({
      ok: true,
      clips: [
        { id: "hook", label: "Hook", script: "Opening." },
        { id: "body1", label: "Body 1", script: "First point." },
        { id: "body2", label: "Body 2", script: "Second point.\nAnother point." },
        { id: "cta", label: "CTA", script: "Follow along." },
      ],
    });
  });

  it("does not require all four tagged parts", () => {
    expect(parseQuickRecordingScript("[[HOOK 1]]\nHi\n[[CTA 1]]\nBye")).toEqual({
      ok: true,
      clips: [
        { id: "hook", label: "Hook", script: "Hi" },
        { id: "cta", label: "CTA", script: "Bye" },
      ],
    });
  });

  it("strips optional beat markers from a plain script without splitting it", () => {
    expect(parseQuickRecordingScript("[[BEAT 1]]\nOne.\n[[BEAT 2]]\nTwo.")).toEqual({
      ok: true,
      clips: [{ id: "full", label: "Full video", script: "One.\nTwo." }],
    });
  });

  it.each([
    ["duplicate headings", "[[HOOK]]\nHello\n[[HOOK 1]]\nAgain", "more than once"],
    ["empty section", "[[HOOK]]\n[[CTA]]\nFollow", "needs script"],
    ["unsupported variation", "[[HOOK 2]]\nA\n[[BODY 1]]\nB", "supports"],
    ["unsupported intro", "[[INTRO 1]]\nHello\n[[CTA]]\nBye", "supports"],
    ["untagged preamble", "Hello\n[[HOOK]]\nWorld", "first section"],
  ])("rejects %s rather than silently dropping content", (_, input, message) => {
    const result = parseQuickRecordingScript(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});
