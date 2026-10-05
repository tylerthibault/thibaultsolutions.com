"use client";

import { useMemo, useState } from "react";
import { TeleprompterStudio, type TeleprompterRecording } from "@/src/components/TeleprompterStudio";

type SegmentKind = "hook" | "body" | "cta";
type SlotState = {
  state: "uploading" | "ready" | "error";
  durationMs?: number;
  error?: string;
};
type SelectedSlot = { kind: SegmentKind; position: number };
type VariationRender = {
  id: string;
  hookPosition: number;
  bodyPosition: number;
  ctaPosition: number;
  durationMs: number;
  sizeBytes: number;
  fileName: string;
  downloadUrl: string;
};

const GROUPS: Array<{
  kind: SegmentKind;
  label: string;
  plural: string;
  description: string;
  accent: string;
}> = [
  {
    kind: "hook",
    label: "Hook",
    plural: "Hooks",
    description: "The first line or visual that earns the next few seconds.",
    accent: "lime",
  },
  {
    kind: "body",
    label: "Body",
    plural: "Bodies",
    description: "The core explanation, demo, story, or proof.",
    accent: "blue",
  },
  {
    kind: "cta",
    label: "CTA",
    plural: "CTAs",
    description: "The close: follow, click, comment, buy, save, or learn more.",
    accent: "amber",
  },
];

const EMPTY_SCRIPTS: Record<SegmentKind, string[]> = {
  hook: ["", "", ""],
  body: ["", "", ""],
  cta: ["", "", ""],
};

function slotKey(kind: SegmentKind, position: number) {
  return kind + ":" + position;
}

function formatDuration(durationMs?: number) {
  if (!durationMs) return "";
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  return String(totalSeconds) + "s";
}

function inferMimeType(file: File) {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

export function VariationStudio() {
  const [batchName, setBatchName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [scripts, setScripts] = useState<Record<SegmentKind, string[]>>(EMPTY_SCRIPTS);
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [take, setTake] = useState<TeleprompterRecording | null>(null);
  const [renders, setRenders] = useState<VariationRender[]>([]);
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const readyCounts = useMemo(() => {
    const counts: Record<SegmentKind, number> = { hook: 0, body: 0, cta: 0 };
    for (const kind of Object.keys(counts) as SegmentKind[]) {
      counts[kind] = [1, 2, 3].filter((position) => slots[slotKey(kind, position)]?.state === "ready").length;
    }
    return counts;
  }, [slots]);

  const combinationCount = readyCounts.hook * readyCounts.body * readyCounts.cta;
  const selectedScript = selected ? scripts[selected.kind][selected.position - 1] : "";

  function updateScript(kind: SegmentKind, position: number, value: string) {
    setScripts((current) => ({
      ...current,
      [kind]: current[kind].map((script, index) => index === position - 1 ? value : script),
    }));
  }

  async function ensureSession() {
    if (sessionId) return sessionId;

    const response = await fetch("/api/creative-circle/variations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: batchName.trim() || "Creative Circle batch" }),
    });
    const payload = await response.json().catch(() => ({})) as { session?: { id?: string }; error?: string };
    if (!response.ok || !payload.session?.id) {
      throw new Error(payload.error || "Could not create this variation batch.");
    }
    setSessionId(payload.session.id);
    return payload.session.id;
  }

  async function uploadSegment(
    kind: SegmentKind,
    position: number,
    body: Blob,
    fileName: string,
    mimeType: string,
  ) {
    const key = slotKey(kind, position);
    setGlobalError("");
    setRenders([]);
    setSlots((current) => ({ ...current, [key]: { state: "uploading" } }));

    try {
      const activeSessionId = await ensureSession();
      const response = await fetch("/api/creative-circle/variations/" + activeSessionId + "/segments", {
        method: "POST",
        headers: {
          "content-type": mimeType || "video/mp4",
          "x-segment-kind": kind,
          "x-segment-position": String(position),
          "x-file-name": encodeURIComponent(fileName),
        },
        body,
      });
      const payload = await response.json().catch(() => ({})) as {
        segment?: { durationMs?: number };
        error?: string;
      };
      if (!response.ok || !payload.segment) throw new Error(payload.error || "The segment could not be added.");

      setSlots((current) => ({
        ...current,
        [key]: { state: "ready", durationMs: payload.segment?.durationMs },
      }));
      setTake(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The segment could not be added.";
      setSlots((current) => ({ ...current, [key]: { state: "error", error: message } }));
      setGlobalError(message);
    }
  }

  async function generate() {
    if (!sessionId || combinationCount < 1) return;
    setGenerating(true);
    setGlobalError("");
    setRenders([]);

    try {
      const response = await fetch("/api/creative-circle/variations/" + sessionId + "/generate", { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { renders?: VariationRender[]; error?: string };
      if (!response.ok || !payload.renders) throw new Error(payload.error || "The variations could not be generated.");
      setRenders(payload.renders);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "The variations could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  return <div className="variation-studio">
    <section className="variation-batch-bar">
      <div>
        <span className="micro">BATCH</span>
        <input
          value={batchName}
          disabled={Boolean(sessionId)}
          onChange={(event) => setBatchName(event.target.value)}
          placeholder="Campaign or product name"
          aria-label="Variation batch name"
        />
        <small>{sessionId ? "Batch name locked after the first segment is saved." : "Name it before saving the first segment."}</small>
      </div>
      <div className="variation-equation" aria-label={readyCounts.hook + " hooks times " + readyCounts.body + " bodies times " + readyCounts.cta + " CTAs equals " + combinationCount + " videos"}>
        <span><b>{readyCounts.hook}</b> HOOKS</span>
        <i>×</i>
        <span><b>{readyCounts.body}</b> BODIES</span>
        <i>×</i>
        <span><b>{readyCounts.cta}</b> CTAs</span>
        <i>=</i>
        <strong>{combinationCount}<small>VIDEOS</small></strong>
      </div>
    </section>

    <section className="variation-groups">
      {GROUPS.map((group) => <article key={group.kind} className={"variation-group accent-" + group.accent}>
        <header>
          <div>
            <span className="micro">{group.plural.toUpperCase()}</span>
            <h2>{group.plural}<span>.</span></h2>
          </div>
          <p>{group.description}</p>
        </header>

        <div className="variation-slot-list">
          {[1, 2, 3].map((position) => {
            const key = slotKey(group.kind, position);
            const state = slots[key];
            const inputId = "variation-upload-" + group.kind + "-" + position;
            return <div className={"variation-slot " + (state?.state || "empty")} key={key}>
              <div className="variation-slot-head">
                <span>{String(position).padStart(2, "0")}</span>
                <strong>
                  {state?.state === "ready" ? "READY " + formatDuration(state.durationMs) :
                    state?.state === "uploading" ? "PREPARING…" :
                    state?.state === "error" ? "TRY AGAIN" : "EMPTY"}
                </strong>
              </div>

              <textarea
                value={scripts[group.kind][position - 1]}
                onChange={(event) => updateScript(group.kind, position, event.target.value)}
                placeholder={group.kind === "hook"
                  ? "Write the hook you want on the teleprompter…"
                  : group.kind === "body"
                    ? "Write the body beat or talking points…"
                    : "Write the CTA…"}
                aria-label={group.label + " " + position + " script"}
              />

              <div className="variation-slot-actions">
                <button
                  type="button"
                  disabled={state?.state === "uploading"}
                  onClick={() => {
                    setSelected({ kind: group.kind, position });
                    setTake(null);
                    setGlobalError("");
                  }}
                >
                  {state?.state === "ready" ? "RE-RECORD" : "RECORD"} <span>●</span>
                </button>
                <label htmlFor={inputId}>
                  UPLOAD <span>↑</span>
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept="video/*"
                  hidden
                  disabled={state?.state === "uploading"}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    void uploadSegment(group.kind, position, file, file.name, inferMimeType(file));
                  }}
                />
              </div>

              {state?.state === "error" && <p className="variation-slot-error">{state.error}</p>}
            </div>;
          })}
        </div>
      </article>)}
    </section>

    {selected && <section className="variation-recorder">
      <div className="variation-recorder-head">
        <div>
          <span className="micro">RECORD / {selected.kind.toUpperCase()} {String(selected.position).padStart(2, "0")}</span>
          <h2>Record it once.<br/><em>Reuse it everywhere.</em></h2>
        </div>
        <button type="button" onClick={() => { setSelected(null); setTake(null); }}>CLOSE ×</button>
      </div>

      <TeleprompterStudio
        key={slotKey(selected.kind, selected.position)}
        initialScript={selectedScript}
        contextLabel={selected.kind.toUpperCase() + " " + String(selected.position).padStart(2, "0") + " / SCRIPT"}
        captureMode
        onScriptChange={(value) => updateScript(selected.kind, selected.position, value)}
        onRecordingChange={setTake}
      />

      <div className="variation-take-actions">
        <div>
          <span className={take ? "ready" : ""}><i /> {take ? "TAKE READY" : "RECORD A TAKE ABOVE"}</span>
          <small>The take is not uploaded until you add it to this batch.</small>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!take || slots[slotKey(selected.kind, selected.position)]?.state === "uploading"}
          onClick={() => {
            if (!take) return;
            void uploadSegment(selected.kind, selected.position, take.blob, take.filename, take.mimeType);
          }}
        >
          {slots[slotKey(selected.kind, selected.position)]?.state === "uploading" ? "PREPARING SEGMENT…" : "ADD TAKE TO BATCH →"}
        </button>
      </div>
    </section>}

    <section className="variation-generate">
      <div>
        <span className="micro">ASSEMBLE</span>
        <h2>{combinationCount ? combinationCount + " combinations ready to build." : "Build the matrix."}</h2>
        <p>
          Record at least one segment in every column. Creative Circle normalizes each saved segment once, then joins the prepared clips to build the combinations quickly.
        </p>
      </div>
      <button
        type="button"
        disabled={!sessionId || combinationCount < 1 || generating}
        onClick={() => void generate()}
      >
        {generating ? "BUILDING " + combinationCount + "…" : "GENERATE " + (combinationCount || 0) + " VIDEOS"} <span>↗</span>
      </button>
    </section>

    {globalError && <div className="variation-global-error">{globalError}</div>}

    {renders.length > 0 && <section className="variation-results">
      <header>
        <div>
          <span className="micro">OUTPUTS</span>
          <h2>{renders.length} finished videos.</h2>
        </div>
        <p>
          Each output gets its own filename and embedded batch identifier for organization. Social platforms can also use visual/audio fingerprinting, so file metadata alone cannot guarantee duplicate classification behavior.
        </p>
      </header>

      <div className="variation-result-grid">
        {renders.map((render, index) => <a
          key={render.id}
          className="variation-result-card"
          href={render.downloadUrl}
          download={render.fileName}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>H{render.hookPosition} · B{render.bodyPosition} · C{render.ctaPosition}</strong>
            <small>{formatDuration(render.durationMs)} · {(render.sizeBytes / 1024 / 1024).toFixed(1)} MB</small>
          </div>
          <b>DOWNLOAD ↓</b>
        </a>)}
      </div>
    </section>}
  </div>;
}
