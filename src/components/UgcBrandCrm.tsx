"use client";

import { useMemo, useState } from "react";
import { UGC_BRAND_UGC_BRAND_STATUSES, type UgcBrandStatus } from "@/src/lib/ugc-brand-types";

export type UgcBrandLead = {
  id: string;
  brand: string;
  category: string;
  signal: string;
  source: string;
  sourceUrl: string | null;
  compensation: string;
  creatorFit: string;
  status: UgcBrandStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  pitchNotes: string;
  researchNotes: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  researchedAt: string;
  createdAt: string;
  updatedAt: string;
};

function toInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toIsoOrNull(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function isClosed(status: UgcBrandStatus) {
  return status === "WON" || status === "PASS";
}

function followUpDue(lead: UgcBrandLead) {
  return Boolean(lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date() && !isClosed(lead.status));
}

function researchStale(lead: UgcBrandLead) {
  const age = Date.now() - new Date(lead.researchedAt).getTime();
  return age > 14 * 24 * 60 * 60 * 1000 && !isClosed(lead.status);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function outreachBody(lead: UgcBrandLead) {
  if (lead.pitchNotes.trim()) return lead.pitchNotes.trim();

  const hello = lead.contactName?.trim() ? `Hi ${lead.contactName.trim()},` : `Hi ${lead.brand} team,`;
  const angle = lead.creatorFit.trim()
    ? `I had a UGC concept for ${lead.brand} built around ${lead.creatorFit.trim().replace(/\.$/, "")}.`
    : `I had a UGC concept in mind for ${lead.brand}.`;

  return [
    hello,
    "",
    `${angle} I create natural short-form content for TikTok, Reels, and paid social, and I'd love to send over a few concepts if you're looking for creator content.`,
    "",
    "Portfolio: https://thibaultsolutions.com",
    "",
    "Best,",
    "Tyler",
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(leads: UgcBrandLead[]) {
  const columns: Array<[string, keyof UgcBrandLead]> = [
    ["Brand", "brand"],
    ["Category", "category"],
    ["Status", "status"],
    ["Signal", "signal"],
    ["Source", "source"],
    ["Source URL", "sourceUrl"],
    ["Compensation", "compensation"],
    ["Creator Fit", "creatorFit"],
    ["Contact Name", "contactName"],
    ["Contact Email", "contactEmail"],
    ["Contact URL", "contactUrl"],
    ["Pitch", "pitchNotes"],
    ["Research Notes", "researchNotes"],
    ["Last Contacted", "lastContactedAt"],
    ["Next Follow-Up", "nextFollowUpAt"],
    ["Researched", "researchedAt"],
  ];

  const rows = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...leads.map((lead) => columns.map(([, key]) => csvCell(lead[key])).join(",")),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ugc-brand-radar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const inputStyle = {
  width: "100%",
  background: "#111",
  color: "#f5f5f5",
  border: "1px solid #3a3a3a",
  padding: "9px 10px",
  borderRadius: 4,
} as const;

const labelStyle = { display: "grid", gap: 5, minWidth: 0 } as const;

function LeadCard({
  lead,
  onChanged,
  onDeleted,
}: {
  lead: UgcBrandLead;
  onChanged: (lead: UgcBrandLead) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState(lead);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function save(patch?: Partial<UgcBrandLead>) {
    setSaving(true);
    setError("");

    const payload = patch ?? {
      brand: draft.brand,
      category: draft.category,
      signal: draft.signal,
      source: draft.source,
      sourceUrl: draft.sourceUrl ?? "",
      compensation: draft.compensation,
      creatorFit: draft.creatorFit,
      status: draft.status,
      contactName: draft.contactName ?? "",
      contactEmail: draft.contactEmail ?? "",
      contactUrl: draft.contactUrl ?? "",
      pitchNotes: draft.pitchNotes,
      researchNotes: draft.researchNotes,
      lastContactedAt: draft.lastContactedAt,
      nextFollowUpAt: draft.nextFollowUpAt,
    };

    const response = await fetch(`/api/creative-circle/admin/ugc-brands/${lead.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Could not save");
      setSaving(false);
      return;
    }

    const next = result.lead as UgcBrandLead;
    setDraft(next);
    onChanged(next);
    setSaving(false);
  }

  async function remove() {
    if (!confirm(`Remove ${lead.brand} from the radar?`)) return;
    const response = await fetch(`/api/creative-circle/admin/ugc-brands/${lead.id}`, { method: "DELETE" });
    if (response.ok) onDeleted(lead.id);
    else setError("Could not remove lead");
  }

  async function markContacted() {
    const now = new Date();
    const followUp = new Date(now);
    followUp.setDate(followUp.getDate() + 3);
    await save({
      lastContactedAt: now.toISOString(),
      nextFollowUpAt: followUp.toISOString(),
      status: "FOLLOW_UP",
    });
  }

  async function copyOutreach() {
    try {
      await navigator.clipboard.writeText(outreachBody(draft));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy outreach text");
    }
  }

  const subject = encodeURIComponent(`UGC collaboration idea for ${draft.brand}`);
  const body = encodeURIComponent(outreachBody(draft));
  const mailto = draft.contactEmail ? `mailto:${draft.contactEmail}?subject=${subject}&body=${body}` : null;
  const due = followUpDue(draft);
  const stale = researchStale(draft);

  return <article className="cc-panel" style={{ padding: 18, display: "grid", gap: 14 }}>
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="micro">{draft.category || "GENERAL"}</span>
          {due && <span className="micro" style={{ color: "#ffd166" }}>FOLLOW-UP DUE</span>}
          {stale && <span className="micro" style={{ color: "#8fd3ff" }}>RESEARCH 14D+</span>}
        </div>
        <h2 style={{ margin: "6px 0 4px", fontSize: 28 }}>{draft.brand}</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{draft.signal || "No current UGC signal recorded yet."}</p>
      </div>

      <select
        aria-label="Pipeline status"
        value={draft.status}
        onChange={(e) => {
          const status = e.target.value as UgcBrandStatus;
          setDraft({ ...draft, status });
          void save({ status });
        }}
        style={{ ...inputStyle, width: 160, fontWeight: 800 }}
      >
        {UGC_BRAND_STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
      <div><span className="micro">COMP</span><div style={{ marginTop: 4 }}>{draft.compensation || "Not listed"}</div></div>
      <div><span className="micro">CONTACT</span><div style={{ marginTop: 4 }}>{draft.contactName || draft.contactEmail || "Not found yet"}</div></div>
      <div><span className="micro">LAST CONTACT</span><div style={{ marginTop: 4 }}>{formatDate(draft.lastContactedAt)}</div></div>
      <div><span className="micro">NEXT FOLLOW-UP</span><div style={{ marginTop: 4 }}>{formatDate(draft.nextFollowUpAt)}</div></div>
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn" onClick={() => setEditing((value) => !value)}>{editing ? "CLOSE EDITOR" : "EDIT LEAD"}</button>
      {mailto && <a className="btn" href={mailto}>EMAIL CONTACT</a>}
      <button className="btn" onClick={() => void copyOutreach()}>{copied ? "COPIED" : "COPY OUTREACH"}</button>
      {(draft.contactUrl || draft.sourceUrl) && <a className="btn" href={draft.contactUrl || draft.sourceUrl || "#"} target="_blank" rel="noreferrer">OPEN CONTACT ↗</a>}
      <button className="btn" onClick={() => void markContacted()} disabled={saving}>CONTACTED + 3D</button>
    </div>

    {editing && <div style={{ borderTop: "1px solid #2d2d2d", paddingTop: 14, display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label style={labelStyle}><span className="micro">BRAND</span><input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">CATEGORY</span><input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">COMPENSATION</span><input value={draft.compensation} onChange={(e) => setDraft({ ...draft, compensation: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">SOURCE</span><input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={inputStyle} /></label>
      </div>

      <label style={labelStyle}><span className="micro">SOURCE URL</span><input value={draft.sourceUrl ?? ""} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} style={inputStyle} /></label>
      <label style={labelStyle}><span className="micro">CURRENT UGC SIGNAL</span><textarea rows={2} value={draft.signal} onChange={(e) => setDraft({ ...draft, signal: e.target.value })} style={inputStyle} /></label>
      <label style={labelStyle}><span className="micro">CONTENT FIT / ANGLE</span><textarea rows={2} value={draft.creatorFit} onChange={(e) => setDraft({ ...draft, creatorFit: e.target.value })} style={inputStyle} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label style={labelStyle}><span className="micro">CONTACT NAME</span><input value={draft.contactName ?? ""} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">CONTACT EMAIL</span><input type="email" value={draft.contactEmail ?? ""} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">CONTACT / APPLY URL</span><input value={draft.contactUrl ?? ""} onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })} style={inputStyle} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label style={labelStyle}><span className="micro">LAST CONTACTED</span><input type="date" value={toInputDate(draft.lastContactedAt)} onChange={(e) => setDraft({ ...draft, lastContactedAt: toIsoOrNull(e.target.value) })} style={inputStyle} /></label>
        <label style={labelStyle}><span className="micro">NEXT FOLLOW-UP</span><input type="date" value={toInputDate(draft.nextFollowUpAt)} onChange={(e) => setDraft({ ...draft, nextFollowUpAt: toIsoOrNull(e.target.value) })} style={inputStyle} /></label>
      </div>

      <label style={labelStyle}>
        <span className="micro">PITCH / OUTREACH DRAFT</span>
        <textarea rows={5} value={draft.pitchNotes} placeholder={outreachBody({ ...draft, pitchNotes: "" })} onChange={(e) => setDraft({ ...draft, pitchNotes: e.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}><span className="micro">RESEARCH NOTES</span><textarea rows={4} value={draft.researchNotes} onChange={(e) => setDraft({ ...draft, researchNotes: e.target.value })} style={inputStyle} /></label>

      {error && <p style={{ color: "#ff8d8d", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => void save()} disabled={saving}>{saving ? "SAVING…" : "SAVE LEAD"}</button>
        {draft.sourceUrl && <a className="btn" href={draft.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a>}
        <button className="btn" onClick={() => void remove()} style={{ marginLeft: "auto" }}>REMOVE</button>
      </div>
    </div>}

    {!editing && error && <p style={{ color: "#ff8d8d", margin: 0 }}>{error}</p>}
  </article>;
}

export function UgcBrandCrm({ initialLeads }: { initialLeads: UgcBrandLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState("");

  const due = leads.filter(followUpDue).length;
  const stale = leads.filter(researchStale).length;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rank: Record<string, number> = { PITCH: 1, NEW: 2, RESEARCH: 3, FOLLOW_UP: 4, APPLIED: 5, WON: 6, PASS: 7 };

    return leads
      .filter((lead) => {
        if (filter === "ACTIVE" && isClosed(lead.status)) return false;
        if (filter === "DUE" && !followUpDue(lead)) return false;
        if (filter === "STALE" && !researchStale(lead)) return false;
        if (!["ACTIVE", "ALL", "DUE", "STALE"].includes(filter) && lead.status !== filter) return false;
        if (!query) return true;
        return [lead.brand, lead.category, lead.signal, lead.source, lead.creatorFit, lead.contactName, lead.contactEmail, lead.researchNotes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aDue = followUpDue(a) ? 0 : 1;
        const bDue = followUpDue(b) ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;
        const statusDiff = (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [leads, filter, search]);

  async function addLead() {
    if (!brand.trim()) return;
    setAdding(true);
    setError("");

    const response = await fetch("/api/creative-circle/admin/ugc-brands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand, category, status: "NEW" }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Could not add lead");
      setAdding(false);
      return;
    }

    setLeads((current) => [result.lead as UgcBrandLead, ...current]);
    setBrand("");
    setCategory("General");
    setAdding(false);
  }

  const addFieldStyle = { ...inputStyle, width: "auto" } as const;

  return <div style={{ display: "grid", gap: 18 }}>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">ACTIVE</span><div style={{ fontSize: 32, fontWeight: 800 }}>{leads.filter((x) => !isClosed(x.status)).length}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">READY TO PITCH</span><div style={{ fontSize: 32, fontWeight: 800 }}>{leads.filter((x) => x.status === "PITCH").length}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">FOLLOW-UPS DUE</span><div style={{ fontSize: 32, fontWeight: 800 }}>{due}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">RESEARCH 14D+</span><div style={{ fontSize: 32, fontWeight: 800 }}>{stale}</div></div>
    </section>

    <section className="cc-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 5, flex: "2 1 220px" }}><span className="micro">ADD BRAND</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" style={addFieldStyle} /></label>
        <label style={{ display: "grid", gap: 5, flex: "1 1 180px" }}><span className="micro">CATEGORY</span><input value={category} onChange={(e) => setCategory(e.target.value)} style={addFieldStyle} /></label>
        <button className="btn" disabled={adding || !brand.trim()} onClick={() => void addLead()}>{adding ? "ADDING…" : "ADD TO RADAR"}</button>
      </div>
      {error && <span style={{ color: "#ff8d8d" }}>{error}</span>}
    </section>

    <section style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        aria-label="Search UGC leads"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search brands, contacts, notes…"
        style={{ ...inputStyle, flex: "1 1 260px", width: "auto" }}
      />
      <button className="btn" onClick={() => downloadCsv(leads)}>EXPORT CSV</button>
    </section>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {["ACTIVE", "DUE", "STALE", "PITCH", "FOLLOW_UP", "APPLIED", "WON", "PASS", "ALL"].map((value) =>
        <button key={value} className="btn" onClick={() => setFilter(value)} style={{ opacity: filter === value ? 1 : .55 }}>{value}</button>
      )}
    </div>

    <div style={{ display: "grid", gap: 14 }}>
      {visible.length
        ? visible.map((lead) => <LeadCard
            key={lead.id}
            lead={lead}
            onChanged={(next) => setLeads((current) => current.map((item) => item.id === next.id ? next : item))}
            onDeleted={(id) => setLeads((current) => current.filter((item) => item.id !== id))}
          />)
        : <div className="cc-panel" style={{ padding: 24 }}><p className="muted" style={{ margin: 0 }}>No leads in this view.</p></div>}
    </div>
  </div>;
}
