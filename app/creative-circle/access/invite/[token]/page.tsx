import { createHash } from "node:crypto";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { getSession } from "@/src/lib/auth";
import { creativeCircleInvitations } from "@/src/lib/schema";
import { AccessInviteAcceptForm } from "@/src/components/AccessInviteAcceptForm";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function CreativeCircleAccessInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite] = await db.select()
    .from(creativeCircleInvitations)
    .where(eq(creativeCircleInvitations.tokenHash, hashToken(token)))
    .limit(1);
  const session = await getSession();

  if (!invite || invite.acceptedAt) {
    return <main className="login-wrap"><section className="login-card">
      <span className="micro" style={{ color: "var(--danger)" }}>INVITE UNAVAILABLE</span>
      <h1>LINK<br/>USED.</h1>
      <p className="muted">Ask the Creative Circle admin for a fresh invitation.</p>
      <Link className="btn" href="/creative-circle/login">SIGN IN</Link>
    </section></main>;
  }

  return <main className="login-wrap"><section className="login-card">
    <span className="micro" style={{ color: "var(--lime)" }}>PRIVATE INVITE / CREATIVE CIRCLE</span>
    <h1>YOU'RE<br/>INVITED.</h1>
    <p className="muted">
      You were invited as <b style={{ color: "var(--ink)" }}>{invite.email}</b>. Accept once, then use normal sign-in from then on.
    </p>
    <AccessInviteAcceptForm
      token={token}
      email={invite.email}
      signedInEmail={session?.user?.email ?? null}
    />
  </section></main>;
}
