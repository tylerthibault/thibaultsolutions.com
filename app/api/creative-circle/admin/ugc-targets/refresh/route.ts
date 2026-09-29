import { NextResponse } from "next/server";
import { z } from "zod";
import { apiCreativeCircleAdmin } from "@/src/lib/api-auth";
import { refreshUgcDiscoveryTargets } from "@/src/lib/ugc-discovery";

const refreshSchema = z.object({
  targetIds: z.array(z.string().uuid()).max(50).optional(),
}).default({});

export async function POST(request: Request) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid refresh request", details: parsed.error.flatten() }, { status: 400 });

  const result = await refreshUgcDiscoveryTargets(parsed.data.targetIds);
  return NextResponse.json(result);
}
