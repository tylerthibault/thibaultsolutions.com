"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Reviewer = { id: string; name: string; email: string };

export function NewFeedbackVideoForm({ reviewers }: { reviewers: Reviewer[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("Untitled Short");
  const [sourceType, setSourceType] = useState<"upload" | "link">("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>(reviewers.map((r) => r.id));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function create() {
    if (sourceType === "upload" && !file) return;
    if (sourceType === "link" && !sourceUrl.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/feedback/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType, sourceUrl: sourceType === "link" ? sourceUrl : undefined, reviewerIds: selected }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not create feedback video.");
      const video = result.video;

      if (sourceType === "upload" && file) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/feedback/videos/${video.id}/upload`);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText || "{}").error || "Upload failed"));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });
      }

      router.push(`/creative-circle/review/video/${video.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add video.");
      setBusy(false);
    }
  }

  return <div className="cc-panel feedback-new-form">
    <div className="field"><label>Video title</label><input className="input" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)}/></div>

    <div className="source-switch">
      <button className={sourceType === "upload" ? "chip active" : "chip"} onClick={() => setSourceType("upload")} type="button">UPLOAD FILE</button>
      <button className={sourceType === "link" ? "chip active" : "chip"} onClick={() => setSourceType("link")} type="button">LINK SHORT</button>
    </div>

    {sourceType === "upload" ? <label className="upload-drop">
      <input style={{ display: "none" }} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/>
      <span className="micro" style={{ color: "var(--lime)" }}>{file ? "VIDEO READY" : "DROP / CHOOSE VIDEO"}</span>
      <h2 style={{ fontSize: 30, margin: "12px 0 8px" }}>{file?.name ?? "MP4 · MOV · M4V · WEBM"}</h2>
      <p className="muted">Uploaded videos support automatic timestamp capture while reviewers watch.</p>
    </label> : <div className="field">
      <label>YouTube Shorts, TikTok, or Instagram Reel URL</label>
      <input className="input" type="url" placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}/>
      <small className="muted">Linked videos can be reviewed in the room; timestamp entry is manual where the platform player does not expose playback time.</small>
    </div>}

    <div>
      <div className="feedback-form-label"><span className="micro">WHO SHOULD REVIEW IT?</span><a href="/creative-circle/review/reviewers">MANAGE REVIEWERS ↗</a></div>
      {reviewers.length === 0 ? <div className="empty"><p>Your circle is empty.</p><a className="btn" href="/creative-circle/review/reviewers">INVITE REVIEWERS</a></div> :
        <div className="reviewer-checks">{reviewers.map((reviewer) => <label key={reviewer.id} className={selected.includes(reviewer.id) ? "reviewer-check selected" : "reviewer-check"}>
          <input type="checkbox" checked={selected.includes(reviewer.id)} onChange={() => toggle(reviewer.id)}/>
          <span><b>{reviewer.name}</b><small>{reviewer.email}</small></span>
        </label>)}</div>}
    </div>

    {busy && sourceType === "upload" && <div><div className="progress"><i style={{ width: `${progress}%` }}/></div><small className="muted">Uploading {progress}%</small></div>}
    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn primary" onClick={create} disabled={busy || !title.trim() || (sourceType === "upload" ? !file : !sourceUrl.trim())}>
      {busy ? "ADDING TO ROOM…" : "SEND TO FEEDBACK ROOM ↘"}
    </button>
  </div>;
}
