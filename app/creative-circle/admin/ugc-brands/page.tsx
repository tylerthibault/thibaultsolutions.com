import Link from "next/link";
import { requireCreativeCircleAdmin } from "@/src/lib/auth";
import { listUgcBrandLeads } from "@/src/lib/ugc-brand-crm";
import { CcNav } from "@/src/components/CcNav";
import { UgcBrandCrm, type UgcBrandLead } from "@/src/components/UgcBrandCrm";
import { isUgcBrandStatus } from "@/src/lib/ugc-brand-types";

export default async function UgcBrandRadarPage() {
  const admin = await requireCreativeCircleAdmin();
  const leads = await listUgcBrandLeads();
  const serialized: UgcBrandLead[] = leads.map((lead) => ({
    ...lead,
    status: isUgcBrandStatus(lead.status) ? lead.status : "RESEARCH",
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    researchedAt: lead.researchedAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }));

  return <>
    <CcNav userEmail={admin.email} />
    <main className="cc-main" style={{ maxWidth: 1240 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / UGC BRAND RADAR</span>
      <h1 className="feedback-page-title">BRAND<br/><span>PIPELINE.</span></h1>
      <p className="muted" style={{ maxWidth: 800, lineHeight: 1.6 }}>
        Private UGC outreach CRM. Track research, pitch readiness, applications, follow-ups, contacts, compensation, and wins without mixing prospecting data into the public portfolio.
      </p>

      <div style={{ margin: "26px 0 18px" }}>
        <UgcBrandCrm initialLeads={serialized} />
      </div>

      <div className="cc-panel" style={{ padding: 18, marginTop: 20 }}>
        <span className="micro">RESEARCH FEED</span>
        <p className="muted" style={{ lineHeight: 1.6, margin: "8px 0 12px" }}>
          Fresh opportunities are curated into the CRM with source links, compensation notes, and fit checks. Leads older than 14 days are flagged so you know what needs re-verification before you pitch. The site does not silently scrape or invent opportunities.
        </p>
        <Link className="btn" href="/creative-circle/admin">BACK TO SITE ADMIN</Link>
      </div>
    </main>
  </>;
}
