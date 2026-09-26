"use client";

import { useMemo, useState } from "react";
import { HOMEPAGE_UGC_SLOTS } from "@/src/lib/homepage-slots";

type SlotState = {
  id: string;
  section: string;
  title: string;
  description: string;
  hasMedia: boolean;
  originalName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  updatedAt: string | null;
};

function durationLabel(ms: number | null) {
  if (!ms) return "—";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function HomepageMediaAdmin({ initialSlots }: { initialSlots: SlotState[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");

  const sections = useMemo(() => {
    const names = [...new Set(HOMEPAGE_UGC_SLOTS.map((slot) => slot.section))];
    return names.map((section) => ({
      section,
      slots: slots.filter((slot) => slot.section === section),
    }));
  }, [slots]);

  function chooseFile(slotId: string) {
    document.getElementById(`homepage-file-${slotId}`)?.click();
  }

  function upload(slotId: string, file: File) {
    setBusy(slotId);
    setMessage("");
    setProgress((current) => ({ ...current, [slotId]: 0 }));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/homepage/admin/slots/${encodeURIComponent(slotId)}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setProgress((current) => ({ ...current, [slotId]: Math.round((event.loaded / event.total) * 100) }));
    };

    xhr.onload = () => {
      setBusy(null);
      const result = JSON.parse(xhr.responseText || "{}");
      if (xhr.status < 200 || xhr.status >= 300) {
        setMessage(result.error ?? "Upload failed.");
        return;
      }
      setSlots((current) => current.map((slot) => slot.id === slotId ? result.slot : slot));
      setMessage(`${result.slot.title} updated on the homepage.`);
    };

    xhr.onerror = () => {
      setBusy(null);
      setMessage("Upload failed before the server responded.");
    };

    xhr.send(file);
  }

  async function remove(slotId: string) {
    if (!window.confirm("Remove this video from the public homepage slot?")) return;
    setBusy(slotId);
    setMessage("");

    const response = await fetch(`/api/homepage/admin/slots/${encodeURIComponent(slotId)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setMessage(result.error ?? "Could not remove video.");
      return;
    }

    setSlots((current) => current.map((slot) => slot.id === slotId ? {
      ...slot,
      hasMedia: false,
      originalName: null,
      width: null,
      height: null,
      durationMs: null,
      mediaUrl: null,
      thumbnailUrl: null,
      updatedAt: null,
    } : slot));
    setMessage("Homepage video removed.");
  }

  return <section className="homepage-admin" id="homepage">
    <div className="homepage-admin-heading">
      <div>
        <span className="micro" style={{ color: "var(--lime)" }}>ADMIN / PUBLIC HOMEPAGE</span>
        <h2>PLACE THE<br/>UGC.</h2>
        <p className="muted">Each phone below maps to one exact location on thibaultsolutions.com. Uploading or replacing a video updates that slot without changing the page layout.</p>
      </div>
      <a className="btn" href="/" target="_blank" rel="noreferrer">VIEW LIVE HOMEPAGE ↗</a>
    </div>

    {message && <div className="homepage-admin-message">{message}</div>}

    <div className="homepage-admin-sections">
      {sections.map(({ section, slots: sectionSlots }) => <div className="homepage-admin-section" key={section}>
        <div className="homepage-admin-section-title"><span>{section}</span><b>{sectionSlots.length} SLOTS</b></div>
        <div className="homepage-admin-grid">
          {sectionSlots.map((slot) => {
            const uploading = busy === slot.id;
            const percent = progress[slot.id] ?? 0;
            return <article className="homepage-admin-slot" key={slot.id}>
              <div className={slot.hasMedia ? "homepage-admin-phone has-media" : "homepage-admin-phone"}>
                <div
                  className="homepage-admin-screen"
                  style={slot.thumbnailUrl ? { backgroundImage: `url("${slot.thumbnailUrl}?v=${encodeURIComponent(slot.updatedAt ?? "")}")` } : undefined}
                >
                  <span className="homepage-admin-slot-label">{slot.title}</span>
                  {!slot.hasMedia && <div className="homepage-admin-empty"><b>NO VIDEO</b><span>{slot.description}</span></div>}
                  {uploading && <div className="homepage-admin-uploading"><strong>{percent}%</strong><span>UPLOADING + PROCESSING</span></div>}
                  <div className="homepage-admin-phone-actions">
                    <button type="button" onClick={() => chooseFile(slot.id)} disabled={uploading}>
                      {slot.hasMedia ? "REPLACE VIDEO" : "UPLOAD VIDEO"}
                    </button>
                    {slot.hasMedia && <button className="danger" type="button" onClick={() => remove(slot.id)} disabled={uploading}>REMOVE</button>}
                  </div>
                </div>
              </div>

              <input
                id={`homepage-file-${slot.id}`}
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) upload(slot.id, file);
                }}
              />

              <div className="homepage-admin-slot-meta">
                <strong>{slot.title}</strong>
                <span>{slot.hasMedia ? `${durationLabel(slot.durationMs)} · ${slot.width ?? "?"}×${slot.height ?? "?"}` : slot.description}</span>
              </div>
            </article>;
          })}
        </div>
      </div>)}
    </div>
  </section>;
}
