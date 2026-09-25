import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getCreativeCirclePermissions, requireUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { mediaAssets, projects, renderJobs } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { SignOutButton } from "@/src/components/SignOutButton";

export default async function CreativeCircleHome() {
  const user = await requireUser();
  const permissions = await getCreativeCirclePermissions(user.id, user.email);

  const rows = permissions.labAccess
    ? await db.select({ project: projects, asset: mediaAssets }).from(projects)
        .leftJoin(mediaAssets, eq(projects.assetId, mediaAssets.id))
        .where(eq(projects.ownerId, user.id)).orderBy(desc(projects.updatedAt)).limit(12)
    : [];

  const jobs = permissions.labAccess
    ? await db.select().from(renderJobs).where(eq(renderJobs.ownerId, user.id))
        .orderBy(desc(renderJobs.createdAt)).limit(10)
    : [];

  const active = new Map(jobs.map((job) => [job.projectId, job]));

  return <>
    <CcNav userEmail={user.email}/>
    <main className="cc-main">
      <section className="cc-hero">
        <div>
          <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / YOUR ACCESS</span>
          <h1>CREATIVE<br/><em>CIRCLE.</em></h1>
          <p className="muted" style={{ maxWidth: 650, fontSize: 16, lineHeight: 1.6 }}>
            Your private creative workspace. The sections below are the tools currently enabled for your account.
          </p>
          <div className="actions">
            {permissions.labAccess && <Link className="btn primary" href="/creative-circle/new">VIDEO LAB ↘</Link>}
            {permissions.feedbackAccess && <Link className="btn" href="/creative-circle/review">FEEDBACK ROOM ↗</Link>}
            <SignOutButton/>
          </div>
        </div>
        <aside className="cc-panel">
          <span className="micro muted">ENABLED SECTIONS</span>
          <div className="cc-section-access-list">
            <div className={permissions.labAccess ? "cc-section-access enabled" : "cc-section-access"}>
              <strong>VIDEO LAB</strong><span>{permissions.labAccess ? "ACCESS ON" : "NO ACCESS"}</span>
            </div>
            <div className={permissions.feedbackAccess ? "cc-section-access enabled" : "cc-section-access"}>
              <strong>FEEDBACK ROOM</strong><span>{permissions.feedbackAccess ? "ACCESS ON" : "NO ACCESS"}</span>
            </div>
          </div>
        </aside>
      </section>

      {permissions.labAccess && <>
        <div className="section-head" style={{ marginBottom: 22 }}>
          <div><span>VIDEO LAB / RECENT PROJECTS</span><h2 style={{ fontSize: 42 }}>KEEP <b>MAKING.</b></h2></div>
        </div>
        {rows.length === 0
          ? <div className="empty"><p>No projects yet.</p><Link className="btn primary" href="/creative-circle/new">UPLOAD YOUR FIRST VIDEO</Link></div>
          : <div className="cc-grid">{rows.map(({ project, asset }) => {
              const job = active.get(project.id);
              return <Link className="cc-card" href={`/creative-circle/project/${project.id}`} key={project.id}>
                {asset?.thumbnailKey ? <img alt="" src={`/api/thumbnails/${asset.id}`}/> : <div style={{ aspectRatio: "16/9", background: "#111722", borderRadius: 8 }}/>}
                <h3>{project.name}</h3>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <small className="muted">{new Date(project.updatedAt).toLocaleString()}</small>
                  {job && <small style={{ color: job.status === "complete" ? "var(--lime)" : "var(--cyan)" }}>
                    {job.status.toUpperCase()} {job.status === "rendering" ? `${job.progress}%` : ""}
                  </small>}
                </div>
              </Link>;
            })}</div>}
      </>}

      {!permissions.labAccess && permissions.feedbackAccess && <section className="cc-panel feedback-only-entry">
        <span className="micro muted">FEEDBACK ROOM</span>
        <h2>WATCH. COMMENT. IMPROVE.</h2>
        <p className="muted">Your account is enabled for private video review and timestamped feedback.</p>
        <Link className="btn primary" href="/creative-circle/review">ENTER FEEDBACK ROOM ↘</Link>
      </section>}
    </main>
  </>;
}
