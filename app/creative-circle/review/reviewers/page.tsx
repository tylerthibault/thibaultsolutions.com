import { and, desc, eq, isNull } from "drizzle-orm";
import { requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { circleInvitations, circleMemberships, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { ReviewersPanel } from "@/src/components/ReviewersPanel";

export default async function ReviewersPage() {
  const current = await requireSectionUser("feedback");
  const members = await db.select({
    userId: users.id,
    name: users.name,
    email: users.email,
    createdAt: circleMemberships.createdAt,
  }).from(circleMemberships)
    .innerJoin(users, eq(circleMemberships.memberUserId, users.id))
    .where(eq(circleMemberships.ownerId, current.id))
    .orderBy(desc(circleMemberships.createdAt));

  const pending = await db.select({
    id: circleInvitations.id,
    email: circleInvitations.email,
    expiresAt: circleInvitations.expiresAt,
    createdAt: circleInvitations.createdAt,
  }).from(circleInvitations)
    .where(and(eq(circleInvitations.ownerId, current.id), isNull(circleInvitations.acceptedAt)))
    .orderBy(desc(circleInvitations.createdAt));

  return <><CcNav userEmail={current.email}/><main className="cc-main" style={{ maxWidth: 980 }}>
    <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK / YOUR CIRCLE</span>
    <h1 className="feedback-page-title">TRUSTED<br/><span>EYES.</span></h1>
    <p className="muted" style={{ maxWidth: 650, lineHeight: 1.6 }}>Invite the people you actually want feedback from. The invite is one-time onboarding; after that they sign in normally.</p>
    <ReviewersPanel initialMembers={members} initialPending={pending}/>
  </main></>;
}
