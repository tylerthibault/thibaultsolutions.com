import { describe, expect, it } from "vitest";
import { parseVariationScript } from "../src/lib/variation-script";

const sample = `[[HOOK 1]]
I used to hate posting.
[[HOOK 2]]
This is how I stopped dreading posts.
[[BODY 1]]
Here's what happened.
[[BODY 2]]
Watch what happens on this screen.
[[CTA 1]]
Follow for more.`;

describe("single-script section parser", () => {
  it("extracts sequential scripts and inferred counts", () => {
    expect(parseVariationScript(sample)).toEqual({
      ok: true,
      value: {
        counts: { hook: 2, body: 2, cta: 1 },
        scripts: {
          "hook:1": "I used to hate posting.",
          "hook:2": "This is how I stopped dreading posts.",
          "body:1": "Here's what happened.",
          "body:2": "Watch what happens on this screen.",
          "cta:1": "Follow for more.",
        },
      },
    });
  });

  it("supports {{ }} markers, mixed case, and spaces", () => {
    const result = parseVariationScript(`{{ Hook 1 }}
Hello

[[ Body1 ]]
World

{{ CTA 1 }}
Go`);
    expect(result).toEqual({
      ok: true,
      value: {
        counts: { hook: 1, body: 1, cta: 1 },
        scripts: { "hook:1": "Hello", "body:1": "World", "cta:1": "Go" },
      },
    });
  });

  it.each([
    ["missing markers", "Hello there", "Add section headings"],
    ["stray introduction", `Hi!\n${sample}`, "before the first heading"],
    ["missing category", "[[HOOK 1]] one\n[[BODY 1]] two", "CTA 1"],
    ["gap in numbering", "[[HOOK 2]] a\n[[BODY 1]] b\n[[CTA 1]] c", "consecutively"],
    ["duplicate marker", "[[HOOK 1]] a\n[[HOOK 1]] b\n[[BODY 1]] c\n[[CTA 1]] d", "more than once"],
    ["empty section", "[[HOOK 1]]\n[[BODY 1]] b\n[[CTA 1]] c", "no script text"],
    ["unknown heading", "[[INTRO 1]] hi\n[[HOOK 1]] a\n[[BODY 1]] b\n[[CTA 1]] c", "Unrecognized"],
    ["too many", "[[HOOK 5]] a\n[[BODY 1]] b\n[[CTA 1]] c", "between 1 and 4"],
  ])("rejects %s", (_, source, message) => {
    const result = parseVariationScript(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});
