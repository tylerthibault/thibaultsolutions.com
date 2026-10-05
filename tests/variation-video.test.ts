import { describe, expect, it } from "vitest";
import { buildVariationCombinations } from "../src/lib/variation-video";

describe("variation combinations", () => {
  it("builds the cartesian product of hooks, bodies, and CTAs", () => {
    const segments = [
      { kind: "hook" as const, position: 1, storageKey: "h1.mp4", durationMs: 1000 },
      { kind: "hook" as const, position: 2, storageKey: "h2.mp4", durationMs: 1100 },
      { kind: "hook" as const, position: 3, storageKey: "h3.mp4", durationMs: 1200 },
      { kind: "body" as const, position: 1, storageKey: "b1.mp4", durationMs: 3000 },
      { kind: "body" as const, position: 2, storageKey: "b2.mp4", durationMs: 3200 },
      { kind: "body" as const, position: 3, storageKey: "b3.mp4", durationMs: 3400 },
      { kind: "cta" as const, position: 1, storageKey: "c1.mp4", durationMs: 900 },
      { kind: "cta" as const, position: 2, storageKey: "c2.mp4", durationMs: 950 },
      { kind: "cta" as const, position: 3, storageKey: "c3.mp4", durationMs: 1000 },
    ];

    const combinations = buildVariationCombinations(segments);

    expect(combinations).toHaveLength(27);
    expect(combinations[0]).toMatchObject({
      hook: { position: 1 },
      body: { position: 1 },
      cta: { position: 1 },
      durationMs: 4900,
    });
    expect(combinations[26]).toMatchObject({
      hook: { position: 3 },
      body: { position: 3 },
      cta: { position: 3 },
      durationMs: 5600,
    });
  });

  it("returns no combinations until every segment kind exists", () => {
    const combinations = buildVariationCombinations([
      { kind: "hook" as const, position: 1, storageKey: "h1.mp4", durationMs: 1000 },
      { kind: "body" as const, position: 1, storageKey: "b1.mp4", durationMs: 3000 },
    ]);

    expect(combinations).toEqual([]);
  });
});
