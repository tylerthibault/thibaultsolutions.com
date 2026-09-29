"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type UgcDiscoveryTargetView = {
  id: string;
  name: string;
  category: string;
  sourceUrl: string;
  sourceType: string;
  keywords: string;
  enabled: boolean;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type RefreshSummary = {
  checked: number;
  leadsChanged: number;
  found: number;
  noMatches: number;
  errors: number;
};

const fieldStyle = {
  width: "100%",
  background: "#111",
  color: "#f5f5f5",
  border: "1px solid #3a3a3a",
  padding: "9px 10px",
  borderRadius: 4,
} as const;

function dateLabel(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Never"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function UgcDiscoveryPanel({ initialTargets }: { initialTargets: UgcDiscoveryTargetView[] }) {
  const router = useRouter();
  const [targets, setTargets] = useState(initialTargets);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [sourceUrl, setSourceUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<RefreshSummary | null>(null);

  useEffect(() => setTargets(initialTargets), [initialTargets]);

  async function reloadTargets() {
    const response = await fetch("/api/creative-circle/admin/ugc-targets", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(result.targets)) {
      setTargets(result.targets as UgcDiscoveryTargetView[]);
    }
  }

  async function addTarget() {
    if (!name.trim() || !sourceUrl.trim()) return;
    setBusy(true);
    setError("");
    setSummary(null);

    const response = await fetch("/api/creative-circle/admin/ugc-targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, category, sourceUrl, keywords }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Could not add target");
      setBusy(false);
      return;
    }

    setTargets((current) => [result.target as UgcDiscoveryTargetView, ...current]);
    setName("");
    setCategory("General");
    setSourceUrl("");
    setKeywords("");
    setBusy(false);
  }

  async function patchTarget(id: string, patch: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/creative-circle/admin/ugc-targets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Could not update target");
      return;
    }
    setTargets((current) => current.map((target) => target.id === id ? result.target as UgcDiscoveryTargetView : target));
  }

  async function removeTarget(target: UgcDiscoveryTargetView) {
    if (!confirm(`Stop watching ${target.name}?`)) return;
    const response = await fetch(`/api/creative-circle/admin/ugc-targets/${target.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not remove target");
      return;
    }
    setTargets((current) => current.filter((item) => item.id !== target.id));
  }

  async function refresh(targetIds?: string[]) {
    setRefreshing(true);
    setError("");
    setSummary(null);

    const response = await fetch("/api/creative-circle/admin/ugc-targets/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(targetIds?.length ? { targetIds } : {}),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Refresh failed");
      setRefreshing(false);
      return;
    }

    setSummary({
      checked: result.checked ?? 0,
      leadsChanged: result.leadsChanged ?? 0,
      found: result.found ?? 0,
      noMatches: result.noMatches ?? 0,
      errors: result.errors ?? 0,
    });
    await reloadTargets();
    router.refresh();
    setRefreshing(false);
  }

  return <section className="cc-panel" style={{ padding: 18, display: "grid", gap: 16 }}>
    <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ maxWidth: 720 }}>
        <span className="micro" style={{ color: "var(--lime)" }}>FREE LEAD DISCOVERY</span>
        <h2 style={{ margin: "7px 0 6px", fontSize: 30 }}>TARGET COMPANIES</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          Add a company website, careers page, Greenhouse, Lever, or Ashby board. Refresh checks public sources for UGC, creator, social-content, TikTok, and related openings without a paid search API.
        </p>
      </div>
      <button className="btn" onClick={() => void refresh()} disabled={refreshing || !targets.some((target) => target.enabled)}>
        {refreshing ? "REFRESHING…" : "REFRESH ALL LEADS"}
      </button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
      <label style={{ display: "grid", gap: 5 }}>
        <span className="micro">COMPANY / BRAND</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Notion" style={fieldStyle} />
      </label>
      <label style={{ display: "grid", gap: 5 }}>
        <span className="micro">CATEGORY</span>
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Tech / SaaS" style={fieldStyle} />
      </label>
      <label style={{ display: "grid", gap: 5, gridColumn: "1 / -1" }}>
        <span className="micro">WEBSITE / CAREERS / JOB BOARD URL</span>
        <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://company.com" style={fieldStyle} />
      </label>
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 5, flex: "1 1 320px" }}>
        <span className="micro">EXTRA KEYWORDS <span className="muted">(OPTIONAL, COMMA-SEPARATED)</span></span>
        <input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="creator economy, product demo, short form" style={fieldStyle} />
      </label>
      <button className="btn" onClick={() => void addTarget()} disabled={busy || !name.trim() || !sourceUrl.trim()}>
        {busy ? "ADDING…" : "WATCH COMPANY"}
      </button>
    </div>

    {summary && <div style={{ border: "1px solid #343f49", padding: 12, borderRadius: 6 }}>
      <span className="micro">LAST REFRESH</span>
      <div style={{ marginTop: 5 }}>
        Checked {summary.checked} · Found {summary.found} · Leads updated {summary.leadsChanged} · No matches {summary.noMatches} · Errors {summary.errors}
      </div>
    </div>}

    {error && <p style={{ color: "#ff8d8d", margin: 0 }}>{error}</p>}

    <div style={{ display: "grid", gap: 9 }}>
      {targets.length === 0 && <div style={{ border: "1px dashed #343f49", padding: 16 }}>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          No companies are being watched yet. Start with a brand website or careers page. The refresher can follow a careers link one level deep, and Greenhouse, Lever, and Ashby boards are detected automatically.
        </p>
      </div>}

      {targets.map((target) => <div key={target.id} style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
        alignItems: "center",
        borderTop: "1px solid #282f36",
        paddingTop: 10,
        opacity: target.enabled ? 1 : .55,
      }}>
        <div style={{ minWidth: 0 }}>
          <strong>{target.name}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis" }}>{target.sourceUrl}</div>
        </div>
        <div>
          <span className="micro">{target.sourceType}</span>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{target.category}</div>
        </div>
        <div>
          <span className="micro">{target.lastStatus || "NOT CHECKED"}</span>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{dateLabel(target.lastCheckedAt)}</div>
          {target.lastError && <div style={{ color: "#ff8d8d", fontSize: 11, marginTop: 3 }}>{target.lastError}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-start" }}>
          <button className="btn" onClick={() => void refresh([target.id])} disabled={refreshing || !target.enabled}>CHECK</button>
          <button className="btn" onClick={() => void patchTarget(target.id, { enabled: !target.enabled })}>{target.enabled ? "PAUSE" : "ENABLE"}</button>
          <a className="btn" href={target.sourceUrl} target="_blank" rel="noreferrer">OPEN ↗</a>
          <button className="btn" onClick={() => void removeTarget(target)}>REMOVE</button>
        </div>
      </div>)}
    </div>
  </section>;
}
