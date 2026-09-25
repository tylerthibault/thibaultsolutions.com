import { and, desc, eq, isNull } from "drizzle-orm";
import { requireCreativeCircleAdmin, isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { creativeCircleInvitations, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { AccessAdminPanel } from "@/src/components/AccessAdminPanel";

export default async function CreativeCircleAdminPage() {
  const admin = await requireCreativeCircleAdmin();
  const [accounts, pendingInvites] = await Promise.all([
    db.select({
      id: users.id, name: users.name, email: users.email, username: users.username,
      labAccess: users.creativeCircleLabAccess, feedbackAccess: users.creativeCircleFeedbackAccess, createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)),
    db.select({
      id: creativeCircleInvitations.id, email: creativeCircleInvitations.email, username: creativeCircleInvitations.username,
      labAccess: creativeCircleInvitations.labAccess, feedbackAccess: creativeCircleInvitations.feedbackAccess,
      expiresAt: creativeCircleInvitations.expiresAt, createdAt: creativeCircleInvitations.createdAt,
    }).from(creativeCircleInvitations)
      .where(and(eq(creativeCircleInvitations.adminId, admin.id), isNull(creativeCircleInvitations.acceptedAt)))
      .orderBy(desc(creativeCircleInvitations.createdAt)),
  ]);

  return <>
    <CcNav userEmail={admin.email}/>
    <main className="cc-main" style={{ maxWidth: 1160 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / SECTION ACCESS</span>
      <h1 className="feedback-page-title">WHO GETS<br/><span>WHAT.</span></h1>
      <p className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>Grant Video Lab, Feedback Lab, or both. Invite a member with either an email address or a username.</p>
      <AccessAdminPanel
        initialUsers={accounts.map((account) => ({ ...account, isAdmin: isCreativeCircleAdmin(account.email), createdAt: account.createdAt.toISOString() }))}
        initialInvites={pendingInvites.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString() }))}
      />
    </main>
  </>;
}
