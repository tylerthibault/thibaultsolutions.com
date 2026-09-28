import Link from "next/link";
import { redirect } from "next/navigation";
import { getCreativeCirclePermissions, requireUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";
import { SignOutButton } from "@/src/components/SignOutButton";

export default async function CreativeCircleHome() {
  const user = await requireUser();
  const permissions = await getCreativeCirclePermissions(user.id, user.email);

  if (permissions.labAccess && !permissions.feedbackAccess) {
    redirect("/creative-circle/lab");
  }

  if (permissions.feedbackAccess && !permissions.labAccess) {
    redirect("/creative-circle/review");
  }

  return <>
    <CcNav userEmail={user.email}/>
    <main className="cc-main">
      <section className="cc-hero">
        <div>
          <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / MODULES</span>
          <h1>CREATIVE<br/><em>CIRCLE.</em></h1>
          <p className="muted" style={{ maxWidth: 650, fontSize: 16, lineHeight: 1.6 }}>
            Choose the workspace you want to enter.
          </p>
          <div className="actions">
            <SignOutButton/>
          </div>
        </div>
        <aside className="cc-panel">
          <span className="micro muted">YOUR MODULES</span>
          <div className="cc-section-access-list">
            <Link className="cc-section-access enabled" href="/creative-circle/lab">
              <strong>VIDEO LAB</strong><span>ENTER ↗</span>
            </Link>
            <Link className="cc-section-access enabled" href="/creative-circle/review">
              <strong>FEEDBACK LAB</strong><span>ENTER ↗</span>
            </Link>
          </div>
        </aside>
      </section>

      <div className="feedback-grid">
        <Link className="feedback-card" href="/creative-circle/lab">
          <div className="feedback-card-art">
            <span className="micro" style={{ color: "var(--cyan)" }}>VIDEO LAB</span>
            <strong>CREATE.<br/>PROCESS.<br/>EXPORT.</strong>
            <small className="muted">Upload video, apply effects, render, and export.</small>
          </div>
          <div className="feedback-card-meta"><span>CREATION MODULE</span><span>OPEN ↗</span></div>
        </Link>

        <Link className="feedback-card" href="/creative-circle/review">
          <div className="feedback-card-art">
            <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK LAB</span>
            <strong>WATCH.<br/>COMMENT.<br/>IMPROVE.</strong>
            <small className="muted">Private review, timestamped comments, and revision notes.</small>
          </div>
          <div className="feedback-card-meta"><span>REVIEW MODULE</span><span>OPEN ↗</span></div>
        </Link>
      </div>
    </main>
  </>;
}
