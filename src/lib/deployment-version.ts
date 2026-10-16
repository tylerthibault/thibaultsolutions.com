/**
 * Public, non-sensitive deployment identity for the health endpoint.
 *
 * Coolify supplies SOURCE_COMMIT and COOLIFY_BRANCH to running containers.
 * Local/test environments can optionally supply APP_REVISION and APP_BRANCH.
 * Do not infer a commit from the source tree: .git is excluded from Docker.
 */
export type DeploymentVersion = {
  commit: string | null;
  shortCommit: string | null;
  branch: string | null;
};

function optionalValue(value: string | undefined) {
  return value?.trim() || null;
}

export function getDeploymentVersion(env: Record<string, string | undefined>): DeploymentVersion {
  const candidate = optionalValue(env.SOURCE_COMMIT) || optionalValue(env.APP_REVISION);
  // Never report placeholders or malformed revisions as a real Git SHA.
  const commit = candidate && /^[0-9a-f]{7,40}$/i.test(candidate) ? candidate.toLowerCase() : null;
  const branch = optionalValue(env.COOLIFY_BRANCH) || optionalValue(env.APP_BRANCH);
  return { commit, shortCommit: commit?.slice(0, 7) ?? null, branch };
}

export function matchesExpectedCommit(actual: string | null, expected: string | null) {
  if (!expected) return null;
  if (!/^[0-9a-f]{7,40}$/i.test(expected)) return null;
  if (!actual) return false;
  // Full hashes compare exactly, short hashes may be used for convenience.
  return actual.startsWith(expected.toLowerCase());
}
