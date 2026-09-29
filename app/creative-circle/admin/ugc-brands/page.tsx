import Link from "next/link";
import { requireCreativeCircleAdmin } from "@/src/lib/auth";
import { listUgcBrandLeads } from "@/src/lib/ugc-brand-crm";
import { listUgcDiscoveryTargets } from "@/src/lib/ugc-discovery";
import { CcNav } from "@/src/components/CcNav";
import { UgcBrandCrm, type UgcBrandLead } from "@/src/components/UgcBrandCrm";
import { UgcDiscoveryPanel, type UgcDiscoveryTargetView } from "@/src/components/UgcDiscoveryPanel";
import { isUgcBrandStatus } from "@/src/lib/ugc-brand-types";

export default async function UgcBrandRadarPage() {
  const admin = await requireCreativeCircleAdmin();
  const [leads, targets] = await Promise.all([listUgcBrandLeads(), listUgcDiscoveryTargets()]);
  const serialized: UgcBrandLead[] = leads.map((lead) => ({
    ...lead,
    status: isUgcBrandStatus(lead.status) ? lead.status : "RESEARCH",
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    discoveredAt: lead.discoveredAt?.toISOString() ?? null,
    lastVerifiedAt: lead.lastVerifiedAt?.toISOString() ?? null,
    researchedAt: lead.researchedAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }));
  const serializedTargets: UgcDiscoveryTargetView[] = targets.map((target) => ({
    ...target,
    lastCheckedAt: target.lastCheckedAt?.toISOString() ?? null,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }));

  return <>
    <CcNav userEmail={admin.email} />
    <main className="cc-main" style={{ maxWidth: 1240 }}>
      <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / UGC BRAND RADAR</span>
      <h1 className="feedback-page-title">BRAND<br/><span>PIPELINE.</span></h1>
      <p className="muted" style={{ maxWidth: 800, lineHeight: 1.6 }}>
        Private UGC outreach CRM. Track research, pitch readiness, applications, follow-ups, contacts, compensation, and wins without mixing prospecting data into the public portfolio.
      </p>

      <div style={{ margin: "26px 0 18px", display: "grid", gap: 18 }}>
        <UgcDiscoveryPanel
          key={serializedTargets.map((target) => `${target.id}:${target.updatedAt}`).join("|")}
          initialTargets={serializedTargets}
        />
        <UgcBrandCrm
          key={serialized.map((lead) => `${lead.id}:${lead.updatedAt}`).join("|")}
          initialLeads={serialized}
        />
      </div>

      <div className="cc-panel" style={{ padding: 18, marginTop: 20 }}>
        <span className="micro">RESEARCH FEED</span>
        <p className="muted" style={{ lineHeight: 1.6, margin: "8px 0 12px" }}>
          The free discovery layer checks the public company sources you choose. Greenhouse and Lever boards are queried directly; standard careers pages are scanned for creator-related openings. Leads are only updated when a current matching source is found, and older results are flagged for re-verification.
        </p>
        <Link className="btn" href="/creative-circle/admin">BACK TO SITE ADMIN</Link>
      </div>
    </main>
  </>;
}
