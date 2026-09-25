import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { creativeCircleInvitations, user as users } from "@/src/lib/schema";

const inviteSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  labAccess: z.boolean().default(true),
  feedbackAccess: z.boolean().default(true),
}).refine((value) => value.labAccess || value.feedbackAccess, { message: "Choose at least one section." });
const deleteSchema = z.object({ id: z.string().uuid() });
const usernamePattern = /^[A-Za-z0-9_.]{3,30}$/;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function targetFromIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (raw.includes("@")) {
    const parsed = z.string().email().max(254).safeParse(raw);
    if (!parsed.success) return null;
    return { email: parsed.data.toLowerCase(), username: null as string | null };
  }
  if (!usernamePattern.test(raw)) return null;
  const username = raw.toLowerCase();
  return { username, email: `cc.${username}@users.thibaultsolutions.invalid` };
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an email or a 3–30 character username and choose at least one section." }, { status: 400 });
  }

  const target = targetFromIdentifier(parsed.data.identifier);
  if (!target) {
    return NextResponse.json({ error: "Use a valid email or username containing letters, numbers, underscores, or dots." }, { status: 400 });
  }

  const requestedLab = parsed.data.labAccess;
  const requestedFeedback = parsed.data.feedbackAccess;
  if (target.email === admin.email.toLowerCase()) {
    return NextResponse.json({ error: "That account is already the Creative Circle admin." }, { status: 400 });
  }

  const existingWhere = target.username
    ? or(eq(users.username, target.username), eq(users.email, target.email))
    : eq(users.email, target.email);

  const [existing] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    username: users.username,
    labAccess: users.creativeCircleLabAccess,
    feedbackAccess: users.creativeCircleFeedbackAccess,
    createdAt: users.createdAt,
  }).from(users).where(existingWhere).limit(1);

  if (existing) {
    const labAccess = existing.labAccess || requestedLab;
    const feedbackAccess = existing.feedbackAccess || requestedFeedback;
    await db.update(users).set({
      creativeCircleAccess: labAccess || feedbackAccess,
      creativeCircleLabAccess: labAccess,
      creativeCircleFeedbackAccess: feedbackAccess,
      updatedAt: new Date(),
    }).where(eq(users.id, existing.id));

    await db.delete(creativeCircleInvitations).where(
      target.username
        ? or(eq(creativeCircleInvitations.username, target.username), eq(creativeCircleInvitations.email, target.email))
        : eq(creativeCircleInvitations.email, target.email),
    );

    return NextResponse.json({
      memberAdded: true,
      account: { ...existing, labAccess, feedbackAccess, createdAt: existing.createdAt.toISOString() },
    }, { status: 201 });
  }

  await db.delete(creativeCircleInvitations).where(
    target.username
      ? or(eq(creativeCircleInvitations.username, target.username), eq(creativeCircleInvitations.email, target.email))
      : eq(creativeCircleInvitations.email, target.email),
  );

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const [invitation] = await db.insert(creativeCircleInvitations).values({
    adminId: admin.id,
    email: target.email,
    username: target.username,
    tokenHash: hashToken(token),
    expiresAt,
    labAccess: requestedLab,
    feedbackAccess: requestedFeedback,
  }).returning({
    id: creativeCircleInvitations.id,
    email: creativeCircleInvitations.email,
    username: creativeCircleInvitations.username,
    labAccess: creativeCircleInvitations.labAccess,
    feedbackAccess: creativeCircleInvitations.feedbackAccess,
    expiresAt: creativeCircleInvitations.expiresAt,
    createdAt: creativeCircleInvitations.createdAt,
  });

  const origin = process.env.APP_URL || new URL(request.url).origin;
  return NextResponse.json({
    invitation: { ...invitation, expiresAt: invitation.expiresAt.toISOString(), createdAt: invitation.createdAt.toISOString() },
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
