import Link from "next/link";
import { requireCreativeCircleAdmin } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";

type BrandOpportunity = {
  brand: string;
  category: string;
  signal: string;
  source: string;
  compensation: string;
  creatorFit: string;
  status: "NEW" | "RESEARCH" | "PITCH" | "APPLIED" | "PASS";
  notes: string;
};

const opportunities: BrandOpportunity[] = [
  {
    brand: "SmashIt Honey",
    category: "Wellness / DTC",
    signal: "Actively seeking UGC creators for TikTok, Reels, and Meta ads",
    source: "Upwork creator brief",
    compensation: "$20 listed",
    creatorFit: "Direct-response product demo / testimonial",
    status: "RESEARCH",
    notes: "Open creator brief found Sept. 29, 2026. Review product and usage-right terms before pitching.",
  },
  {
    brand: "Summers Ahead",
    category: "Financial services",
    signal: "Seeking natural-looking creators ages 28–55 for Facebook and Instagram ads",
    source: "Upwork creator brief",
    compensation: "Not listed",
    creatorFit: "Talking-head testimonial / problem-solution",
    status: "RESEARCH",
    notes: "Age range fits. Financial-services claims require extra care; verify brief language and required disclosures.",
  },
];

const statusClass: Record<BrandOpportunity["status"], string> = {
  NEW: "#d9ff3f",
  RESEARCH: "#8fd3ff",
  PITCH: "#ffd166",
  APPLIED: "#8cffb1",
  PASS: "#999",
};

export default async function UgcBrandRadarPage() {
  const admin = await requireCreativeCircleAdmin();
  const active = opportunities.filter((item) => item.status !== "PASS").length;

  return <>
    <CcNav userEmail={admin.email} />
    <main className="cc-main" style={{ maxWidth: 1240 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / UGC BRAND RADAR</span>
      <h1 className="feedback-page-title">BRANDS WORTH<br/><span>CHASING.</span></h1>
      <p className="muted" style={{ maxWidth: 760, lineHeight: 1.6 }}>
        A private working list of brands with current UGC signals. Use this as the research and outreach queue—not as a public portfolio page.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "28px 0" }}>
        <div className="cc-panel" style={{ padding: 18 }}><span className="micro">ACTIVE LEADS</span><div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>{active}</div></div>
        <div className="cc-panel" style={{ padding: 18 }}><span className="micro">READY TO PITCH</span><div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>{opportunities.filter((x) => x.status === "PITCH").length}</div></div>
        <div className="cc-panel" style={{ padding: 18 }}><span className="micro">APPLIED</span><div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>{opportunities.filter((x) => x.status === "APPLIED").length}</div></div>
        <div className="cc-panel" style={{ padding: 18 }}><span className="micro">LAST RESEARCH</span><div style={{ fontSize: 20, fontWeight: 800, marginTop: 12 }}>SEP 29, 2026</div></div>
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        {opportunities.map((item) => <article key={item.brand} className="cc-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <span className="micro">{item.category}</span>
              <h2 style={{ margin: "6px 0 4px", fontSize: 28 }}>{item.brand}</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{item.signal}</p>
            </div>
            <span className="micro" style={{ border: `1px solid ${statusClass[item.status]}`, color: statusClass[item.status], padding: "7px 10px" }}>{item.status}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 18 }}>
            <div><span className="micro">SOURCE</span><div style={{ marginTop: 5 }}>{item.source}</div></div>
            <div><span className="micro">COMPENSATION</span><div style={{ marginTop: 5 }}>{item.compensation}</div></div>
            <div><span className="micro">CONTENT FIT</span><div style={{ marginTop: 5 }}>{item.creatorFit}</div></div>
          </div>

          <p className="muted" style={{ margin: "18px 0 0", lineHeight: 1.55 }}>{item.notes}</p>
        </article>)}
      </div>

      <div className="cc-panel" style={{ padding: 20, marginTop: 18 }}>
        <span className="micro">NEXT ITERATION</span>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 12 }}>
          The next build step is persistent CRM controls: add/edit brands, change status, save contacts and pitch notes, and track follow-up dates in PostgreSQL.
        </p>
        <Link className="btn" href="/creative-circle/admin">BACK TO SITE ADMIN</Link>
      </div>
    </main>
  </>;
}
