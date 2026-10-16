import { describe, expect, it } from "vitest";
import { getDeploymentVersion, matchesExpectedCommit } from "../src/lib/deployment-version";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("deployment identity", () => {
  it("reads the exact Coolify runtime revision and branch", () => {
    expect(getDeploymentVersion({
      SOURCE_COMMIT: SHA.toUpperCase(),
      COOLIFY_BRANCH: "dev",
    })).toEqual({ commit: SHA, shortCommit: "0123456", branch: "dev" });
  });

  it("supports explicit local revisions without claiming unknown values", () => {
    expect(getDeploymentVersion({ APP_REVISION: SHA, APP_BRANCH: "main" }))
      .toEqual({ commit: SHA, shortCommit: "0123456", branch: "main" });
    expect(getDeploymentVersion({})).toEqual({ commit: null, shortCommit: null, branch: null });
    expect(getDeploymentVersion({ SOURCE_COMMIT: "unknown" }))
      .toEqual({ commit: null, shortCommit: null, branch: null });
  });

  it("compares exact SHA or SHA prefix, never guesses when unknown", () => {
    expect(matchesExpectedCommit(SHA, SHA)).toBe(true);
    expect(matchesExpectedCommit(SHA, "0123456")).toBe(true);
    expect(matchesExpectedCommit(SHA, "abcdef0")).toBe(false);
    expect(matchesExpectedCommit(null, "0123456")).toBe(false);
    expect(matchesExpectedCommit(SHA, null)).toBe(null);
    expect(matchesExpectedCommit(SHA, "bad input")).toBe(null);
  });
});
