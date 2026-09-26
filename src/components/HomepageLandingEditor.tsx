"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SlotState = {
  id: string;
  section: string;
  title: string;
  description: string;
  hasMedia: boolean;
  sourceType: "upload" | "link" | null;
  sourceUrl: string | null;
  provider: string | null;
  embedUrl: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  updatedAt: string | null;
};

export function HomepageLandingEditor() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [frameVersion, setFrameVersion] = useState(0);
  const [fileSlot, setFileSlot] = useState<string | null>(null);
  const [linkSlot, setLinkSlot] = useState<SlotState | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [message, setMessage] = useState("");

  const refreshSlots = useCallback(async () => {
    const response = await fetch("/api/homepage/slots", { cache: "no-store" });
    const result = await response.json().catch(() => ({ slots: [] }));
    if (response.ok) setSlots(result.slots ?? []);
  }, []);

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  function reloadPreview() {
    setFrameVersion((value) => value + 1);
    void refreshSlots();
  }

  function chooseFile(slotId: string) {
    setFileSlot(slotId);
    fileInputRef.current?.click();
  }

  async function uploadFile(slotId: string, file: File) {
    const chunkSize = 8 * 1024 * 1024;
    const chunkCount = Math.max(1, Math.ceil(file.size / chunkSize));
    const uploadToken = crypto.randomUUID();

    setBusy(slotId);
    setMessage("");
    setProgress(0);
    setUploadPhase("uploading");

    try {
      for (let index = 0; index < chunkCount; index += 1) {
        const start = index * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end, file.type || "application/octet-stream");

        const response = await fetch(`/api/homepage/admin/slots/${encodeURIComponent(slotId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Upload-Token": uploadToken,
            "X-Chunk-Index": String(index),
            "X-Chunk-Count": String(chunkCount),
            "X-File-Size": String(file.size),
            "X-File-Name": encodeURIComponent(file.name),
            "X-File-Type": file.type || "video/mp4",
          },
          body: chunk,
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error ?? `Chunk ${index + 1} failed.`);
        }

        setProgress(Math.round(((index + 1) / chunkCount) * 100));
      }

      setProgress(100);
      setUploadPhase("processing");

      const response = await fetch(`/api/homepage/admin/slots/${encodeURIComponent(slotId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadToken,
          originalName: file.name,
          mimeType: file.type || "video/mp4",
          fileSize: file.size,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Video processing failed.");
      }

      setMessage("Homepage video updated.");
      reloadPreview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Homepage upload failed.");
    } finally {
      setBusy(null);
      setUploadPhase("idle");
    }
  }

  async function connectLink() {
    if (!linkSlot || !linkValue.trim()) return;
    const slotId = linkSlot.id;
    setBusy(slotId);
    setMessage("");

    const response = await fetch(`/api/homepage/admin/slots/${encodeURIComponent(slotId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkValue.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setMessage(result.error ?? "Could not connect that link.");
      return;
    }

    setLinkSlot(null);
    setLinkValue("");
    setMessage("Homepage link connected.");
    reloadPreview();
  }

  async function remove(slotId: string) {
    if (!window.confirm("Remove this video or link from the public homepage?")) return;
    setBusy(slotId);
    setMessage("");

    const response = await fetch(`/api/homepage/admin/slots/${encodeURIComponent(slotId)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setMessage(result.error ?? "Could not remove homepage media.");
      return;
    }

    setMessage("Homepage media removed.");
    reloadPreview();
  }

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc || slots.length === 0) return;

    const styleId = "homepage-editor-injected-style";
    let style = doc.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = styleId;
      doc.head.appendChild(style);
    }
    style.textContent = `
      [data-home-slot]{isolation:isolate}
      .homepage-edit-controls{position:absolute;z-index:50}
      .homepage-edit-empty{inset:0;display:grid;place-items:center;align-content:center;gap:8px;padding:18px;background:rgba(5,8,12,.72);backdrop-filter:blur(2px)}
      .homepage-edit-empty button{width:min(150px,84%);min-height:38px;border:1px solid #a3ff12;border-radius:7px;background:#a3ff12;color:#071000;font:800 9px/1 "Space Grotesk",sans-serif;letter-spacing:.03em;cursor:pointer;box-shadow:3px 3px 0 #101010}
      .homepage-edit-empty button.link{background:#0d1117;color:#f2f5f1;border-color:#5968ff;box-shadow:3px 3px 0 #5968ff}
      .homepage-edit-empty button:disabled{opacity:.55;cursor:wait}
      .homepage-edit-remove{top:7px;right:7px;display:grid;place-items:center;width:27px;height:27px;border:1px solid #ff7f8e;border-radius:50%;background:#190c10;color:#ff7f8e;font:900 19px/1 Arial,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.35)}
      .homepage-edit-remove:hover{background:#ff7f8e;color:#13070a}
      .homepage-edit-remove:disabled{opacity:.55;cursor:wait}
      .homepage-edit-busy{position:absolute;z-index:60;inset:auto 8px 8px 8px;padding:9px 10px;border-radius:7px;background:#071000;color:#a3ff12;font:800 8px/1.2 "Space Grotesk",sans-serif;text-align:center;border:1px solid #446d10}
    `;

    doc.querySelectorAll(".homepage-edit-controls,.homepage-edit-busy").forEach((node) => node.remove());

    for (const slot of slots) {
      const screen = doc.querySelector<HTMLElement>(`[data-home-slot="${slot.id}"]`);
      if (!screen) continue;

      if (slot.hasMedia) {
        const removeButton = doc.createElement("button");
        removeButton.className = "homepage-edit-controls homepage-edit-remove";
        removeButton.type = "button";
        removeButton.textContent = "−";
        removeButton.title = "Remove homepage media";
        removeButton.disabled = busy === slot.id;
        removeButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void remove(slot.id);
        });
        screen.appendChild(removeButton);
      } else {
        const controls = doc.createElement("div");
        controls.className = "homepage-edit-controls homepage-edit-empty";

        const uploadButton = doc.createElement("button");
        uploadButton.type = "button";
        uploadButton.textContent = busy === slot.id
          ? uploadPhase === "processing" ? "PROCESSING…" : "UPLOADING…"
          : "UPLOAD FILE";
        uploadButton.disabled = busy === slot.id;
        uploadButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          chooseFile(slot.id);
        });

        const linkButton = doc.createElement("button");
        linkButton.className = "link";
        linkButton.type = "button";
        linkButton.textContent = "CONNECT LINK";
        linkButton.disabled = busy === slot.id;
        linkButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setLinkSlot(slot);
          setLinkValue("");
        });

        controls.append(uploadButton, linkButton);
        screen.appendChild(controls);
      }

      if (busy === slot.id) {
        const busyLabel = doc.createElement("div");
        busyLabel.className = "homepage-edit-busy";
        busyLabel.textContent = uploadPhase === "processing"
          ? "UPLOAD COMPLETE · PROCESSING VIDEO…"
          : `UPLOADING ${progress}%`;
        screen.appendChild(busyLabel);
      }
    }
  }, [slots, busy, progress, uploadPhase, frameVersion]);

  return <div className="homepage-editor-page">
    {message && <div className="homepage-editor-toast">{message}</div>}

    <iframe
      key={frameVersion}
      ref={frameRef}
      className="homepage-editor-frame"
      src={`/?homepage-editor=${frameVersion}`}
      title="Homepage editor"
      onLoad={() => {
        setFrameVersion((value) => value);
        void refreshSlots();
      }}
    />

    <input
      ref={fileInputRef}
      type="file"
      hidden
      accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.currentTarget.value = "";
        if (file && fileSlot) uploadFile(fileSlot, file);
      }}
    />

    {linkSlot && <div className="homepage-link-modal-backdrop" onMouseDown={() => !busy && setLinkSlot(null)}>
      <div className="homepage-link-modal" onMouseDown={(event) => event.stopPropagation()}>
        <span className="micro" style={{ color: "var(--lime)" }}>CONNECT / {linkSlot.title.toUpperCase()}</span>
        <h2>PASTE THE VIDEO LINK.</h2>
        <p>TikTok, Instagram Reel/post, YouTube, or YouTube Shorts.</p>
        <input
          className="input"
          type="url"
          autoFocus
          placeholder="https://..."
          value={linkValue}
          onChange={(event) => setLinkValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void connectLink();
            if (event.key === "Escape" && !busy) setLinkSlot(null);
          }}
        />
        <div className="homepage-link-actions">
          <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => setLinkSlot(null)}>CANCEL</button>
          <button className="btn primary" type="button" disabled={Boolean(busy) || !linkValue.trim()} onClick={() => void connectLink()}>
            {busy ? "CONNECTING…" : "CONNECT VIDEO ↘"}
          </button>
        </div>
        {message && <div className="muted homepage-link-error">{message}</div>}
      </div>
    </div>}
  </div>;
}
