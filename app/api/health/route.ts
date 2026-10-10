import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getDeploymentVersion, matchesExpectedCommit } from "@/src/lib/deployment-version";
import { ensureStorage } from "@/src/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A live readiness check plus the Git revision Coolify is actually running. */
export async function GET(request: Request) {
  const deployment = getDeploymentVersion(process.env);
  const expectedCommit = new URL(request.url).searchParams.get("expected")?.trim() || null;
  const expectedCommitIsValid = expectedCommit === null || /^[0-9a-f]{7,40}$/i.test(expectedCommit);
  const revisionCheck = expectedCommit && expectedCommitIsValid
    ? { expectedCommit, matchesExpectedCommit: matchesExpectedCommit(deployment.commit, expectedCommit) }
    : {};

  if (!expectedCommitIsValid) {
    return NextResponse.json(
      { ok: false, error: "expected must be a 7-40 character hexadecimal Git commit SHA.", deployment },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    await db.execute(sql`select 1`);
    await ensureStorage();
    return NextResponse.json(
      { ok: true, deployment, ...revisionCheck },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, deployment, ...revisionCheck },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
