import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { creativeCircleInvitations, user as users } from "@/src/lib/schema";

const inviteSchema = z.object({ email: z.string().trim().email().max(254) });
const deleteSchema = z.object({ id: z.string().uuid() });

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function adminFor(request: Request) {
  const admin = await apiSessionUser(request);
  if (!admin || !isCreativeCircleAdmin(admin.email)) return null;
  return admin;
}

export async function POST(request: Request) {
  const admin = await adminFor(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  if (email === admin.email.toLowerCase()) {
    return NextResponse.json({ error: "That account is already the Creative Circle admin." }, { status: 400 });
  }

  const [existing] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db.update(users)
      .set({ creativeCircleAccess: true, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    await db.delete(creativeCircleInvitations).where(eq(creativeCircleInvitations.email, email));

    return NextResponse.json({
      memberAdded: true,
      account: {
        ...existing,
        createdAt: existing.createdAt.toISOString(),
        creativeCircleAccess: true,
      },
    }, { status: 201 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [invitation] = await db.insert(creativeCircleInvitations).values({
    adminId: admin.id,
    email,
    tokenHash: hashToken(token),
    expiresAt,
  }).onConflictDoUpdate({
    target: creativeCircleInvitations.email,
    set: {
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt,
      acceptedAt: null,
      createdAt: new Date(),
    },
  }).returning({
    id: creativeCircleInvitations.id,
    email: creativeCircleInvitations.email,
    expiresAt: creativeCircleInvitations.expiresAt,
    createdAt: creativeCircleInvitations.createdAt,
  });

  const origin = process.env.APP_URL || new URL(request.url).origin;
  return NextResponse.json({
    invitation: {
      ...invitation,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    },
    inviteUrl: `${origin}/creative-circle/access/invite/${token}`,
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const admin = await adminFor(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });

  await db.delete(creativeCircleInvitations).where(and(
    eq(creativeCircleInvitations.id, parsed.data.id),
    eq(creativeCircleInvitations.adminId, admin.id),
    isNull(creativeCircleInvitations.acceptedAt),
  ));

  return NextResponse.json({ ok: true });
}
