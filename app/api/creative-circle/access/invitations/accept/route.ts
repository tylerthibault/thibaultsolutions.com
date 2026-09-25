import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { createAuth } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { creativeCircleInvitations, user as users } from "@/src/lib/schema";

const schema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(12).max(128).optional(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function inviteLabel(invite: { email: string; username: string | null }) {
  return invite.username ? `@${invite.username}` : invite.email;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invitation request." }, { status: 400 });

  const [invite] = await db.select().from(creativeCircleInvitations)
    .where(eq(creativeCircleInvitations.tokenHash, hashToken(parsed.data.token))).limit(1);

  if (!invite || invite.acceptedAt) return NextResponse.json({ error: "This invitation is no longer available." }, { status: 404 });
  if (invite.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });

  const sessionUser = await apiSessionUser(request);
  let memberId: string;

  if (sessionUser) {
    const [identity] = await db.select({ email: users.email, username: users.username })
      .from(users).where(eq(users.id, sessionUser.id)).limit(1);
    const matches = invite.username
      ? identity?.username === invite.username
      : identity?.email.toLowerCase() === invite.email.toLowerCase();
    if (!matches) {
      return NextResponse.json({ error: `This invitation is for ${inviteLabel(invite)}.` }, { status: 403 });
    }
    memberId = sessionUser.id;
  } else {
    const existingWhere = invite.username
      ? or(eq(users.username, invite.username), eq(users.email, invite.email))
      : eq(users.email, invite.email);
    const [existing] = await db.select().from(users).where(existingWhere).limit(1);
    if (existing) {
      return NextResponse.json({
        error: `An account already exists for ${inviteLabel(invite)}. Sign in, then open the invitation again.`,
        code: "ACCOUNT_EXISTS",
      }, { status: 409 });
    }

    if (!parsed.data.name || !parsed.data.password) {
      return NextResponse.json({ error: "Name and password are required to create your account." }, { status: 400 });
    }

    const signupAuth = createAuth(false);
    try {
      await signupAuth.api.signUpEmail({
        body: {
          name: parsed.data.name,
          email: invite.email,
          password: parsed.data.password,
          username: invite.username ?? undefined,
        },
      });
    } catch (error) {
      console.error("Creative Circle access invite signup failed", error);
      return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
    }

    const [created] = await db.select().from(users).where(existingWhere).limit(1);
    if (!created) return NextResponse.json({ error: "Account creation did not complete." }, { status: 500 });
    memberId = created.id;
  }

  const [current] = await db.select({
    labAccess: users.creativeCircleLabAccess,
    feedbackAccess: users.creativeCircleFeedbackAccess,
  }).from(users).where(eq(users.id, memberId)).limit(1);

  const labAccess = Boolean(current?.labAccess || invite.labAccess);
  const feedbackAccess = Boolean(current?.feedbackAccess || invite.feedbackAccess);

  await db.update(users).set({
    creativeCircleAccess: labAccess || feedbackAccess,
    creativeCircleLabAccess: labAccess,
    creativeCircleFeedbackAccess: feedbackAccess,
    updatedAt: new Date(),
  }).where(eq(users.id, memberId));
  await db.update(creativeCircleInvitations).set({ acceptedAt: new Date() }).where(eq(creativeCircleInvitations.id, invite.id));

  return NextResponse.json({ ok: true, identifier: inviteLabel(invite), access: { labAccess, feedbackAccess } });
}
