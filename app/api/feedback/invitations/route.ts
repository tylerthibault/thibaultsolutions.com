import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { circleInvitations, circleMemberships, user as users } from "@/src/lib/schema";

const inviteSchema = z.object({ email: z.string().trim().email().max(254) });

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const owner = await apiUser(request);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await db.select({
    userId: users.id, name: users.name, email: users.email, createdAt: circleMemberships.createdAt,
  }).from(circleMemberships)
    .innerJoin(users, eq(circleMemberships.memberUserId, users.id))
    .where(eq(circleMemberships.ownerId, owner.id))
    .orderBy(desc(circleMemberships.createdAt));

  const pending = await db.select({
    id: circleInvitations.id, email: circleInvitations.email, expiresAt: circleInvitations.expiresAt, createdAt: circleInvitations.createdAt,
  }).from(circleInvitations)
    .where(and(eq(circleInvitations.ownerId, owner.id), isNull(circleInvitations.acceptedAt)))
    .orderBy(desc(circleInvitations.createdAt));

  return NextResponse.json({ members, pending });
}

export async function POST(request: Request) {
  const owner = await apiUser(request);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (email === owner.email.toLowerCase()) return NextResponse.json({ error: "You are already the circle owner." }, { status: 400 });

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db.insert(circleMemberships).values({ ownerId: owner.id, memberUserId: existing.id }).onConflictDoNothing();
    return NextResponse.json({ memberAdded: true, member: { userId: existing.id, name: existing.name, email: existing.email } }, { status: 201 });
  }

  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.insert(circleInvitations).values({ ownerId: owner.id, email, tokenHash: hash, expiresAt })
    .onConflictDoUpdate({
      target: [circleInvitations.ownerId, circleInvitations.email],
      set: { tokenHash: hash, expiresAt, acceptedAt: null, createdAt: new Date() },
    });

  const origin = process.env.APP_URL || new URL(request.url).origin;
  return NextResponse.json({ inviteUrl: `${origin}/creative-circle/invite/${token}`, email, expiresAt }, { status: 201 });
}
