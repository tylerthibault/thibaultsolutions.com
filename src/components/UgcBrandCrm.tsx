"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type UgcBrandLead = {
  id: string;
  brand: string;
  category: string;
  signal: string;
  source: string;
  sourceUrl: string | null;
  compensation: string;
  creatorFit: string;
  status: string;
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

const STATUSES = ["NEW", "RESEARCH", "PITCH", "APPLIED", "FOLLOW_UP", "WON", "PASS"];

function toInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toIsoOrNull(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function LeadCard({ lead, onChanged, onDeleted }: { lead: UgcBrandLead; onChanged: (lead: UgcBrandLead) => void; onDeleted: (id: string) => void }) {
  const [draft, setDraft] = useState(lead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(patch?: Partial<UgcBrandLead>) {
    setSaving(true); setError("");
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
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Could not save"); setSaving(false); return; }
    const next = { ...result.lead, lastContactedAt: result.lead.lastContactedAt ?? null, nextFollowUpAt: result.lead.nextFollowUpAt ?? null } as UgcBrandLead;
    setDraft(next); onChanged(next); setSaving(false);
  }

  async function remove() {
    if (!confirm(`Remove ${lead.brand} from the radar?`)) return;
    const response = await fetch(`/api/creative-circle/admin/ugc-brands/${lead.id}`, { method: "DELETE" });
    if (response.ok) onDeleted(lead.id); else setError("Could not remove lead");
  }

  const fieldStyle = { width: "100%", background: "#111", color: "#f5f5f5", border: "1px solid #3a3a3a", padding: "9px 10px", borderRadius: 4 };
  const labelStyle = { display: "grid", gap: 5, minWidth: 0 };

  return <article className="cc-panel" style={{ padding: 18, display: "grid", gap: 16 }}>
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px" }}>
        <span className="micro">{draft.category || "GENERAL"}</span>
        <input aria-label="Brand" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} style={{ ...fieldStyle, fontSize: 24, fontWeight: 800, marginTop: 6 }} />
      </div>
      <select aria-label="Pipeline status" value={draft.status} onChange={(e) => { const status = e.target.value; setDraft({ ...draft, status }); void save({ status }); }} style={{ ...fieldStyle, width: 160, fontWeight: 800 }}>
        {STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <label style={labelStyle}><span className="micro">CATEGORY</span><input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">COMPENSATION</span><input value={draft.compensation} onChange={(e) => setDraft({ ...draft, compensation: e.target.value })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">SOURCE</span><input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">SOURCE URL</span><input value={draft.sourceUrl ?? ""} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} style={fieldStyle} /></label>
    </div>

    <label style={labelStyle}><span className="micro">CURRENT UGC SIGNAL</span><textarea rows={2} value={draft.signal} onChange={(e) => setDraft({ ...draft, signal: e.target.value })} style={fieldStyle} /></label>
    <label style={labelStyle}><span className="micro">CONTENT FIT / ANGLE</span><textarea rows={2} value={draft.creatorFit} onChange={(e) => setDraft({ ...draft, creatorFit: e.target.value })} style={fieldStyle} /></label>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <label style={labelStyle}><span className="micro">CONTACT NAME</span><input value={draft.contactName ?? ""} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">CONTACT EMAIL</span><input type="email" value={draft.contactEmail ?? ""} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">CONTACT / APPLY URL</span><input value={draft.contactUrl ?? ""} onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })} style={fieldStyle} /></label>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <label style={labelStyle}><span className="micro">LAST CONTACTED</span><input type="date" value={toInputDate(draft.lastContactedAt)} onChange={(e) => setDraft({ ...draft, lastContactedAt: toIsoOrNull(e.target.value) })} style={fieldStyle} /></label>
      <label style={labelStyle}><span className="micro">NEXT FOLLOW-UP</span><input type="date" value={toInputDate(draft.nextFollowUpAt)} onChange={(e) => setDraft({ ...draft, nextFollowUpAt: toIsoOrNull(e.target.value) })} style={fieldStyle} /></label>
    </div>

    <label style={labelStyle}><span className="micro">PITCH / OUTREACH NOTES</span><textarea rows={3} value={draft.pitchNotes} onChange={(e) => setDraft({ ...draft, pitchNotes: e.target.value })} style={fieldStyle} /></label>
    <label style={labelStyle}><span className="micro">RESEARCH NOTES</span><textarea rows={3} value={draft.researchNotes} onChange={(e) => setDraft({ ...draft, researchNotes: e.target.value })} style={fieldStyle} /></label>

    {error && <p style={{ color: "#ff8d8d", margin: 0 }}>{error}</p>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn" onClick={() => void save()} disabled={saving}>{saving ? "SAVING…" : "SAVE LEAD"}</button>
      {draft.sourceUrl && <a className="btn" href={draft.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a>}
      {draft.contactUrl && <a className="btn" href={draft.contactUrl} target="_blank" rel="noreferrer">OPEN CONTACT ↗</a>}
      <button className="btn" onClick={() => void remove()} style={{ marginLeft: "auto" }}>REMOVE</button>
    </div>
  </article>;
}

export function UgcBrandCrm({ initialLeads }: { initialLeads: UgcBrandLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState("ACTIVE");
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState("");

  const visible = useMemo(() => leads.filter((lead) => filter === "ALL" || (filter === "ACTIVE" ? !["WON", "PASS"].includes(lead.status) : lead.status === filter)), [leads, filter]);
  const due = leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date() && !["WON", "PASS"].includes(lead.status)).length;

  async function addLead() {
    if (!brand.trim()) return;
    setAdding(true); setError("");
    const response = await fetch("/api/creative-circle/admin/ugc-brands", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand, category, status: "NEW" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Could not add lead"); setAdding(false); return; }
    setLeads((current) => [result.lead, ...current]); setBrand(""); setCategory("General"); setAdding(false); router.refresh();
  }

  const fieldStyle = { background: "#111", color: "#f5f5f5", border: "1px solid #3a3a3a", padding: "9px 10px", borderRadius: 4 };

  return <div style={{ display: "grid", gap: 18 }}>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">ACTIVE</span><div style={{ fontSize: 32, fontWeight: 800 }}>{leads.filter((x) => !["WON", "PASS"].includes(x.status)).length}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">READY TO PITCH</span><div style={{ fontSize: 32, fontWeight: 800 }}>{leads.filter((x) => x.status === "PITCH").length}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">FOLLOW-UPS DUE</span><div style={{ fontSize: 32, fontWeight: 800 }}>{due}</div></div>
      <div className="cc-panel" style={{ padding: 16 }}><span className="micro">WON</span><div style={{ fontSize: 32, fontWeight: 800 }}>{leads.filter((x) => x.status === "WON").length}</div></div>
    </section>

    <section className="cc-panel" style={{ padding: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ display: "grid", gap: 5, flex: "2 1 220px" }}><span className="micro">ADD BRAND</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" style={fieldStyle} /></label>
      <label style={{ display: "grid", gap: 5, flex: "1 1 180px" }}><span className="micro">CATEGORY</span><input value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle} /></label>
      <button className="btn" disabled={adding || !brand.trim()} onClick={() => void addLead()}>{adding ? "ADDING…" : "ADD TO RADAR"}</button>
      {error && <span style={{ color: "#ff8d8d" }}>{error}</span>}
    </section>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {["ACTIVE", "ALL", ...STATUSES].map((value) => <button key={value} className="btn" onClick={() => setFilter(value)} style={{ opacity: filter === value ? 1 : .55 }}>{value}</button>)}
    </div>

    <div style={{ display: "grid", gap: 14 }}>
      {visible.length ? visible.map((lead) => <LeadCard key={lead.id} lead={lead} onChanged={(next) => setLeads((current) => current.map((item) => item.id === next.id ? next : item))} onDeleted={(id) => setLeads((current) => current.filter((item) => item.id !== id))} />) : <div className="cc-panel" style={{ padding: 24 }}><p className="muted" style={{ margin: 0 }}>No leads in this view.</p></div>}
    </div>
  </div>;
}
