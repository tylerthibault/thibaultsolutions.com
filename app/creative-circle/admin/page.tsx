import { desc } from "drizzle-orm";
import { requireCreativeCircleAdmin, isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { AccessAdminPanel } from "@/src/components/AccessAdminPanel";

export default async function CreativeCircleAdminPage() {
  const admin = await requireCreativeCircleAdmin();
  const accounts = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    enabled: users.creativeCircleAccess,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));

  return <>
    <CcNav userEmail={admin.email}/>
    <main className="cc-main" style={{ maxWidth: 1100 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / CREATIVE CIRCLE ACCESS</span>
      <h1 className="feedback-page-title">WHO GETS<br/><span>INSIDE.</span></h1>
      <p className="muted" style={{ maxWidth: 680, lineHeight: 1.6 }}>
        Turn Creative Circle access on or off for any account. Removing access does not delete their projects, comments, or account; it only blocks entry until you enable them again.
      </p>
      <AccessAdminPanel initialUsers={accounts.map((account) => ({
        ...account,
        isAdmin: isCreativeCircleAdmin(account.email),
        createdAt: account.createdAt.toISOString(),
      }))}/>
    </main>
  </>;
}
