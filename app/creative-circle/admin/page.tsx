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
      id: users.id,
      name: users.name,
      email: users.email,
      enabled: users.creativeCircleAccess,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)),
    db.select({
      id: creativeCircleInvitations.id,
      email: creativeCircleInvitations.email,
      expiresAt: creativeCircleInvitations.expiresAt,
      createdAt: creativeCircleInvitations.createdAt,
    }).from(creativeCircleInvitations)
      .where(and(
        eq(creativeCircleInvitations.adminId, admin.id),
        isNull(creativeCircleInvitations.acceptedAt),
      ))
      .orderBy(desc(creativeCircleInvitations.createdAt)),
  ]);

  return <>
    <CcNav userEmail={admin.email}/>
    <main className="cc-main" style={{ maxWidth: 1100 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / CREATIVE CIRCLE ACCESS</span>
      <h1 className="feedback-page-title">WHO GETS<br/><span>INSIDE.</span></h1>
      <p className="muted" style={{ maxWidth: 680, lineHeight: 1.6 }}>
        Invite members, enable existing accounts, or remove access. Removing access keeps their account and work intact so you can restore it later.
      </p>
      <AccessAdminPanel
        initialUsers={accounts.map((account) => ({
          ...account,
          isAdmin: isCreativeCircleAdmin(account.email),
          createdAt: account.createdAt.toISOString(),
        }))}
        initialInvites={pendingInvites.map((invite) => ({
          ...invite,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </main>
  </>;
}
