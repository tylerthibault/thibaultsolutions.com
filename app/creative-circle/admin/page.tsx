import { and, desc, eq, isNull } from "drizzle-orm";
import { requireCreativeCircleAdmin, isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { HOMEPAGE_UGC_SLOTS } from "@/src/lib/homepage-slots";
import { creativeCircleInvitations, homepageUgcSlots, mediaAssets, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { AccessAdminPanel } from "@/src/components/AccessAdminPanel";
import { HomepageMediaAdmin } from "@/src/components/HomepageMediaAdmin";

export default async function CreativeCircleAdminPage() {
  const admin = await requireCreativeCircleAdmin();

  const [accounts, pendingInvites, homepageRows] = await Promise.all([
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
    db.select({
      slot: homepageUgcSlots.slot,
      assetId: homepageUgcSlots.assetId,
      originalName: mediaAssets.originalName,
      width: mediaAssets.width,
      height: mediaAssets.height,
      durationMs: mediaAssets.durationMs,
      updatedAt: homepageUgcSlots.updatedAt,
    }).from(homepageUgcSlots)
      .leftJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id)),
  ]);

  const homepageBySlot = new Map(homepageRows.map((row) => [row.slot, row]));

  return <>
    <CcNav userEmail={admin.email}/>
    <main className="cc-main" style={{ maxWidth: 1360 }}>
      <HomepageMediaAdmin initialSlots={HOMEPAGE_UGC_SLOTS.map((definition) => {
        const row = homepageBySlot.get(definition.id);
        const hasMedia = Boolean(row?.assetId);
        return {
          ...definition,
          hasMedia,
          originalName: row?.originalName ?? null,
          width: row?.width ?? null,
          height: row?.height ?? null,
          durationMs: row?.durationMs ?? null,
          updatedAt: row?.updatedAt?.toISOString() ?? null,
          mediaUrl: hasMedia ? `/api/homepage/slots/${definition.id}/media` : null,
          thumbnailUrl: hasMedia ? `/api/homepage/slots/${definition.id}/thumbnail` : null,
        };
      })}/>

      <section className="homepage-admin-access" id="access">
        <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / MEMBER ACCESS</span>
        <h1 className="feedback-page-title">WHO GETS<br/><span>WHAT.</span></h1>
        <p className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>Grant Video Lab, Feedback Lab, or both. Invite a member with either an email address or a username.</p>
        <AccessAdminPanel
          initialUsers={accounts.map((account) => ({ ...account, isAdmin: isCreativeCircleAdmin(account.email), createdAt: account.createdAt.toISOString() }))}
          initialInvites={pendingInvites.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString() }))}
        />
      </section>
    </main>
  </>;
}
