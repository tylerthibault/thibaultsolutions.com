import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { mediaAssets, projects, renderJobs } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { SignOutButton } from "@/src/components/SignOutButton";

export default async function VideoLabHome() {
  const user = await requireSectionUser("lab");

  const [rows, jobs] = await Promise.all([
    db.select({ project: projects, asset: mediaAssets }).from(projects)
      .leftJoin(mediaAssets, eq(projects.assetId, mediaAssets.id))
      .where(eq(projects.ownerId, user.id))
      .orderBy(desc(projects.updatedAt))
      .limit(12),
    db.select().from(renderJobs)
      .where(eq(renderJobs.ownerId, user.id))
      .orderBy(desc(renderJobs.createdAt))
      .limit(10),
  ]);

  const active = new Map(jobs.map((job) => [job.projectId, job]));

  return <>
    <CcNav userEmail={user.email}/>
    <main className="cc-main">
      <section className="cc-hero">
        <div>
          <span className="micro" style={{ color: "var(--cyan)" }}>CREATIVE CIRCLE / VIDEO LAB</span>
          <h1>VIDEO<br/><em>LAB.</em></h1>
          <p className="muted" style={{ maxWidth: 650, fontSize: 16, lineHeight: 1.6 }}>
            Upload footage, experiment with effects, render variations, and export the final MP4.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/creative-circle/new">NEW PROJECT ↘</Link>
            <SignOutButton/>
          </div>
        </div>
        <aside className="cc-panel">
          <span className="micro muted">WORKFLOW</span>
          <div className="feedback-loop">
            <b>01</b><span>UPLOAD VIDEO</span>
            <b>02</b><span>BUILD EFFECT STACK</span>
            <b>03</b><span>PREVIEW + ADJUST</span>
            <b>04</b><span>RENDER + EXPORT</span>
          </div>
        </aside>
      </section>

      <div className="section-head" style={{ marginBottom: 22 }}>
        <div><span>VIDEO LAB / RECENT PROJECTS</span><h2 style={{ fontSize: 42 }}>KEEP <b>MAKING.</b></h2></div>
      </div>

      {rows.length === 0
        ? <div className="empty"><p>No projects yet.</p><Link className="btn primary" href="/creative-circle/new">UPLOAD YOUR FIRST VIDEO</Link></div>
        : <div className="cc-grid">{rows.map(({ project, asset }) => {
            const job = active.get(project.id);
            return <Link className="cc-card" href={`/creative-circle/project/${project.id}`} key={project.id}>
              {asset?.thumbnailKey
                ? <img alt="" src={`/api/thumbnails/${asset.id}`}/>
                : <div style={{ aspectRatio: "16/9", background: "#111722", borderRadius: 8 }}/>}
              <h3>{project.name}</h3>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <small className="muted">{new Date(project.updatedAt).toLocaleString()}</small>
                {job && <small style={{ color: job.status === "complete" ? "var(--lime)" : "var(--cyan)" }}>
                  {job.status.toUpperCase()} {job.status === "rendering" ? `${job.progress}%` : ""}
                </small>}
              </div>
            </Link>;
          })}</div>}
    </main>
  </>;
}
