import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshUgcDiscoveryTargets } from "@/src/lib/ugc-discovery";

function authorized(request: Request) {
  const secret = process.env.UGC_DISCOVERY_CRON_TOKEN;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!process.env.UGC_DISCOVERY_CRON_TOKEN) {
    return NextResponse.json({ error: "UGC discovery cron is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshUgcDiscoveryTargets();
  return NextResponse.json({ ok: true, ...result });
}
