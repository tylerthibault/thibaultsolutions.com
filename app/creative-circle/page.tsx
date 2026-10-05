import Link from "next/link";
import { redirect } from "next/navigation";
import { getCreativeCirclePermissions, isCreativeCircleAdmin, requireUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";

export default async function CreativeCircleHome() {
  const user = await requireUser();
  const permissions = await getCreativeCirclePermissions(user.id, user.email);
  const admin = isCreativeCircleAdmin(user.email);

  if (permissions.labAccess && !permissions.feedbackAccess) {
    redirect("/creative-circle/lab");
  }

  if (permissions.feedbackAccess && !permissions.labAccess) {
    redirect("/creative-circle/review");
  }

  const workspaces = [
    ...(permissions.labAccess ? [{
      href: "/creative-circle/lab",
      number: "01",
      label: "VIDEO LAB",
      title: "Create",
      accent: "cyan",
      description: "Upload footage, experiment with effects, render versions, and export finished creative.",
      action: "Open workspace",
      meta: "PROCESS / RENDER / EXPORT",
      glyph: "◫",
    }] : []),
    {
      href: "/creative-circle/teleprompter",
      number: "02",
      label: "TELEPROMPTER",
      title: "Perform",
      accent: "amber",
      description: "Read naturally over a live camera preview with adjustable pacing, type size, eye line, and camera direction.",
      action: "Open prompter",
      meta: "SCRIPT / CAMERA / DELIVER",
      glyph: "▤",
    },
    ...(permissions.labAccess ? [{
      href: "/creative-circle/variations",
      number: "03",
      label: "VARIATION STUDIO",
      title: "Multiply",
      accent: "cyan",
      description: "Record hooks, bodies, and CTAs once, then assemble every combination into finished vertical videos.",
      action: "Open studio",
      meta: "RECORD / COMBINE / EXPORT",
      glyph: "✣",
    }] : []),
    ...(permissions.feedbackAccess ? [{
      href: "/creative-circle/review",
      number: "04",
      label: "FEEDBACK LAB",
      title: "Review",
      accent: "lime",
      description: "Watch work in context, leave timestamped notes, and turn feedback into cleaner revisions.",
      action: "Open reviews",
      meta: "WATCH / COMMENT / IMPROVE",
      glyph: "◉",
    }] : []),
    ...(admin ? [{
      href: "/creative-circle/admin/ugc-brands",
      number: "05",
      label: "UGC RADAR",
      title: "Discover",
      accent: "violet",
      description: "Research creator opportunities, track outreach, and keep promising brands moving through the pipeline.",
      action: "Open radar",
      meta: "DISCOVER / PITCH / FOLLOW UP",
      glyph: "⌁",
    }] : []),
  ];

  return <>
    <CcNav userEmail={user.email}/>
    <main className="cc-dashboard">
      <section className="cc-dashboard-hero">
        <div className="cc-dashboard-hero-copy">
          <div className="cc-dashboard-kicker">
            <span className="cc-live-dot" />
            CREATIVE CIRCLE
            <span>/</span>
            COMMAND CENTER
          </div>
          <h1>Your creative<br/><em>workspace.</em></h1>
          <p>
            Build, review, and move the next piece of work forward without bouncing between disconnected tools.
          </p>
        </div>

        <div className="cc-dashboard-glance">
          <div className="cc-glance-head">
            <span className="micro">WORKSPACE STATUS</span>
            <span className="cc-status-chip"><i /> ONLINE</span>
          </div>
          <div className="cc-glance-grid">
            <div>
              <strong>{workspaces.length.toString().padStart(2, "0")}</strong>
              <span>Active spaces</span>
            </div>
            <div>
              <strong>{admin ? "OWNER" : "MEMBER"}</strong>
              <span>Access level</span>
            </div>
          </div>
          <div className="cc-glance-foot">
            <span>Everything here is private to Creative Circle.</span>
            <span>↘</span>
          </div>
        </div>
      </section>

      <section className="cc-workspace-section">
        <div className="cc-workspace-heading">
          <div>
            <span className="micro">YOUR WORKSPACES</span>
            <h2>Pick up where<br/>you left off.</h2>
          </div>
          <p>
            Each space has one job. No duplicate menus, no extra steps — just the tool you need next.
          </p>
        </div>

        <div className="cc-workspace-grid">
          {workspaces.map((workspace) => <Link
            key={workspace.href}
            className={`cc-workspace-card accent-${workspace.accent}`}
            href={workspace.href}
          >
            <div className="cc-workspace-card-top">
              <span className="cc-workspace-number">{workspace.number}</span>
              <span className="cc-workspace-glyph" aria-hidden="true">{workspace.glyph}</span>
            </div>
            <div className="cc-workspace-card-copy">
              <span className="micro">{workspace.label}</span>
              <h3>{workspace.title}<span>.</span></h3>
              <p>{workspace.description}</p>
            </div>
            <div className="cc-workspace-card-meta">
              <span>{workspace.meta}</span>
              <strong>{workspace.action} <i>↗</i></strong>
            </div>
          </Link>)}
        </div>
      </section>

      <section className="cc-dashboard-utility">
        <div>
          <span className="micro">QUICK ROUTES</span>
          <p>Jump straight into the next action.</p>
        </div>
        <div className="cc-quick-links">
          {permissions.labAccess && <Link href="/creative-circle/new">NEW VIDEO <span>+</span></Link>}
          <Link href="/creative-circle/teleprompter">OPEN PROMPTER <span>▶</span></Link>
          {permissions.labAccess && <Link href="/creative-circle/variations">VARIATION STUDIO <span>✣</span></Link>}
          {permissions.feedbackAccess && <Link href="/creative-circle/review">OPEN REVIEWS <span>↗</span></Link>}
          {admin && <Link href="/creative-circle/admin">SITE ADMIN <span>⌘</span></Link>}
        </div>
      </section>
    </main>
  </>;
}
