import { createHash } from "node:crypto";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { getSession } from "@/src/lib/auth";
import { circleInvitations } from "@/src/lib/schema";
import { InviteAcceptForm } from "@/src/components/InviteAcceptForm";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite] = await db.select().from(circleInvitations).where(eq(circleInvitations.tokenHash, hashToken(token))).limit(1);
  const session = await getSession();

  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return <main className="login-wrap"><section className="login-card">
      <span className="micro" style={{ color: "var(--danger)" }}>INVITE UNAVAILABLE</span>
      <h1>LINK<br/>EXPIRED.</h1>
      <p className="muted">Ask the circle owner for a fresh invitation.</p>
      <Link className="btn" href="/creative-circle/login">SIGN IN</Link>
    </section></main>;
  }

  return <main className="login-wrap"><section className="login-card">
    <span className="micro" style={{ color: "var(--lime)" }}>PRIVATE INVITE / CREATIVE CIRCLE</span>
    <h1>JOIN THE<br/>CIRCLE.</h1>
    <p className="muted">You were invited as <b style={{ color: "var(--ink)" }}>{invite.email}</b>. Create your account once; after that, use normal sign-in.</p>
    <InviteAcceptForm token={token} email={invite.email} signedInEmail={session?.user?.email ?? null}/>
  </section></main>;
}
