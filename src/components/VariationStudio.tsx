"use client";

import { useMemo, useState } from "react";
import { TeleprompterStudio, type TeleprompterRecording } from "@/src/components/TeleprompterStudio";
import { MAX_SCRIPT_VARIATIONS_PER_GROUP, parseVariationScript } from "@/src/lib/variation-script";

type SegmentKind = "hook" | "body" | "cta";
type SlotState = {
  state: "uploading" | "ready" | "error";
  durationMs?: number;
  error?: string;
};
type SequenceStep = { kind: SegmentKind; position: number };
type CapturedTake = SequenceStep & {
  blob: Blob;
  mimeType: string;
  fileName: string;
};
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

const MAX_SEGMENTS_PER_GROUP = MAX_SCRIPT_VARIATIONS_PER_GROUP;

const GROUPS: Array<{
  kind: SegmentKind;
  label: string;
  plural: string;
  accent: string;
}> = [
  { kind: "hook", label: "Hook", plural: "Hooks", accent: "lime" },
  { kind: "body", label: "Body", plural: "Bodies", accent: "blue" },
  { kind: "cta", label: "CTA", plural: "CTAs", accent: "amber" },
];

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

function buildSequence(counts: Record<SegmentKind, number>) {
  return GROUPS.flatMap((group) =>
    Array.from({ length: counts[group.kind] }, (_, index) => ({
      kind: group.kind,
      position: index + 1,
    })),
  );
}

function stepName(step: SequenceStep) {
  const group = GROUPS.find((item) => item.kind === step.kind);
  return (group?.label || step.kind) + " " + step.position;
}

export function VariationStudio() {
  const [batchName, setBatchName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [counts, setCounts] = useState<Record<SegmentKind, number>>({
    hook: 3,
    body: 3,
    cta: 3,
  });
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [masterScript, setMasterScript] = useState("");
  const [masterScriptError, setMasterScriptError] = useState("");
  const [scriptImported, setScriptImported] = useState(false);
  const [autoStartStepKey, setAutoStartStepKey] = useState("");
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [takes, setTakes] = useState<CapturedTake[]>([]);
  const [started, setStarted] = useState(false);
  const [segmentsSaved, setSegmentsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renders, setRenders] = useState<VariationRender[]>([]);
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const parsedMasterScript = useMemo(
    () => masterScript.trim() ? parseVariationScript(masterScript) : null,
    [masterScript],
  );
  const setupCounts = parsedMasterScript?.ok ? parsedMasterScript.value.counts : counts;
  const setupCombinationCount = setupCounts.hook * setupCounts.body * setupCounts.cta;
  const sequence = useMemo(() => buildSequence(counts), [counts]);
  const currentStep = sequence[takes.length] || null;
  const currentKey = currentStep ? slotKey(currentStep.kind, currentStep.position) : "";
  const currentScript = currentStep ? scripts[currentKey] || "" : "";
  const allTakesCaptured = takes.length === sequence.length;
  const targetCombinationCount = counts.hook * counts.body * counts.cta;

  const readyCounts = useMemo(() => {
    const ready: Record<SegmentKind, number> = { hook: 0, body: 0, cta: 0 };
    for (const step of sequence) {
      if (slots[slotKey(step.kind, step.position)]?.state === "ready") ready[step.kind] += 1;
    }
    return ready;
  }, [sequence, slots]);

  const combinationCount = readyCounts.hook * readyCounts.body * readyCounts.cta;
  const uploadProgress = sequence.length
    ? Math.round(((readyCounts.hook + readyCounts.body + readyCounts.cta) / sequence.length) * 100)
    : 0;

  function updateCount(kind: SegmentKind, delta: number) {
    if (started) return;
    setCounts((current) => ({
      ...current,
      [kind]: Math.min(MAX_SEGMENTS_PER_GROUP, Math.max(1, current[kind] + delta)),
    }));
  }

  function updateCurrentScript(value: string) {
    if (!currentStep) return;
    setScripts((current) => ({ ...current, [currentKey]: value }));
  }

  function markCurrentTake(recording: TeleprompterRecording | null) {
    if (!recording || !currentStep) return;

    const step = currentStep;
    const nextStep = sequence[takes.length + 1];
    setAutoStartStepKey(nextStep ? slotKey(nextStep.kind, nextStep.position) : "");
    setTakes((current) => [
      ...current,
      {
        ...step,
        blob: recording.blob,
        mimeType: recording.mimeType,
        fileName: recording.filename,
      },
    ]);
    setSlots((current) => {
      const next = { ...current };
      delete next[slotKey(step.kind, step.position)];
      return next;
    });
    setSegmentsSaved(false);
    setRenders([]);
    setGlobalError("");
  }

  function addUploadedTake(file: File) {
    if (!currentStep) return;
    const step = currentStep;
    setAutoStartStepKey("");
    setTakes((current) => [
      ...current,
      {
        ...step,
        blob: file,
        mimeType: inferMimeType(file),
        fileName: file.name,
      },
    ]);
    setSegmentsSaved(false);
    setRenders([]);
    setGlobalError("");
  }

  function deleteLastTake() {
    if (!takes.length) return;
    const last = takes[takes.length - 1];
    setAutoStartStepKey("");

    setTakes((current) => current.slice(0, -1));
    setSlots((current) => {
      const next = { ...current };
      delete next[slotKey(last.kind, last.position)];
      return next;
    });
    setSegmentsSaved(false);
    setRenders([]);
    setGlobalError("");
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

  async function uploadTake(activeSessionId: string, take: CapturedTake) {
    const key = slotKey(take.kind, take.position);
    setSlots((current) => ({ ...current, [key]: { state: "uploading" } }));

    const response = await fetch("/api/creative-circle/variations/" + activeSessionId + "/segments", {
      method: "POST",
      headers: {
        "content-type": take.mimeType || "video/mp4",
        "x-segment-kind": take.kind,
        "x-segment-position": String(take.position),
        "x-file-name": encodeURIComponent(take.fileName),
      },
      body: take.blob,
    });
    const payload = await response.json().catch(() => ({})) as {
      segment?: { durationMs?: number };
      error?: string;
    };

    if (!response.ok || !payload.segment) {
      const message = payload.error || "The segment could not be added.";
      setSlots((current) => ({ ...current, [key]: { state: "error", error: message } }));
      throw new Error(message);
    }

    setSlots((current) => ({
      ...current,
      [key]: { state: "ready", durationMs: payload.segment?.durationMs },
    }));
  }

  async function saveSegments() {
    if (!allTakesCaptured || saving) return;

    setSaving(true);
    setSegmentsSaved(false);
    setGlobalError("");
    setRenders([]);

    try {
      const activeSessionId = await ensureSession();
      for (const take of takes) {
        await uploadTake(activeSessionId, take);
      }
      setSegmentsSaved(true);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "The recorded segments could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!sessionId || !segmentsSaved || combinationCount < 1) return;
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

  return <div className="variation-studio variation-sequential">
    <section className={"variation-sequence-setup" + (started ? " locked" : "")}>
      <div className="variation-sequence-batch">
        <span className="micro">BATCH</span>
        <input
          value={batchName}
          disabled={Boolean(sessionId)}
          onChange={(event) => setBatchName(event.target.value)}
          placeholder="Campaign or product name"
          aria-label="Variation batch name"
        />
        <small>{sessionId ? "Batch name locked after the segments are saved." : "Give this recording session a name."}</small>
      </div>

      {!started && <div className="variation-master-script">
        <div className="variation-master-script-heading">
          <div>
            <span className="micro">ONE SCRIPT / EVERY TAKE</span>
            <h3>Paste the whole script once.</h3>
          </div>
          <small>Optional — leave blank to write each prompt as you record.</small>
        </div>
        <p>
          Label sections with <code>[[HOOK 1]]</code>, <code>[[BODY 1]]</code>, and <code>[[CTA 1]]</code>.
          You can also use <code>{"{{HOOK 1}}"}</code>. The lab will read the labels,
          set the counts, and cue each section in order.
        </p>
        <textarea
          className="variation-master-script-input"
          value={masterScript}
          onChange={(event) => {
            setMasterScript(event.target.value);
            setMasterScriptError("");
          }}
          spellCheck
          aria-label="Full variation script with labeled sections"
          placeholder={"[[HOOK 1]]\nFirst opening...\n\n[[HOOK 2]]\nAlternative opening...\n\n[[BODY 1]]\nMain message...\n\n[[CTA 1]]\nYour call to action..."}
        />
        {masterScriptError && <p className="variation-master-script-error" role="alert">{masterScriptError}</p>}
        {parsedMasterScript?.ok && <p className="variation-master-script-success" role="status">
          Detected {setupCounts.hook} hook{setupCounts.hook === 1 ? "" : "s"},
          {" "}{setupCounts.body} bod{setupCounts.body === 1 ? "y" : "ies"}, and
          {" "}{setupCounts.cta} CTA{setupCounts.cta === 1 ? "" : "s"} —
          {" "}{setupCombinationCount} possible videos.
        </p>}
      </div>}

      <div className="variation-count-builder">
        {GROUPS.map((group) => <div className={"variation-count-control accent-" + group.accent} key={group.kind}>
          <span>{group.plural.toUpperCase()}</span>
          <div>
            <button
              type="button"
              disabled={started || Boolean(masterScript.trim()) || counts[group.kind] <= 1}
              onClick={() => updateCount(group.kind, -1)}
              aria-label={"Remove one " + group.label}
            >−</button>
            <strong>{setupCounts[group.kind]}</strong>
            <button
              type="button"
              disabled={started || Boolean(masterScript.trim()) || counts[group.kind] >= MAX_SEGMENTS_PER_GROUP}
              onClick={() => updateCount(group.kind, 1)}
              aria-label={"Add one " + group.label}
            >+</button>
          </div>
        </div>)}
      </div>

      <div className="variation-target-equation">
        <span>{setupCounts.hook} HOOKS</span><i>×</i>
        <span>{setupCounts.body} BODIES</span><i>×</i>
        <span>{setupCounts.cta} CTAs</span><i>=</i>
        <strong>{setupCombinationCount}<small>VIDEOS</small></strong>
      </div>

      {!started && <button
        type="button"
        className="variation-start-sequence"
        onClick={() => {
          if (masterScript.trim()) {
            const parsed = parseVariationScript(masterScript);
            if (!parsed.ok) {
              setMasterScriptError(parsed.error);
              return;
            }
            setCounts(parsed.value.counts);
            setScripts(parsed.value.scripts);
            setScriptImported(true);
          } else {
            setScriptImported(false);
          }
          setAutoStartStepKey("");
          setStarted(true);
          setGlobalError("");
          setRenders([]);
        }}
      >
        START RECORDING <span>→</span>
      </button>}
    </section>

    {!started && <section className="variation-sequence-intro">
      <span className="micro">ONE RECORDING FLOW</span>
      <h2>Set the matrix.<br/><em>Then record straight through.</em></h2>
      <p>
        Paste one tagged script or write prompts one at a time. Creative Circle cues each Hook, Body, and CTA in order. After each recording, review it, choose Keep &amp; Next or Redo, and the next countdown starts automatically. Delete walks backward through your kept takes.
      </p>
    </section>}

    {started && <section className="variation-sequence-shell">
      <header className="variation-sequence-head">
        <div>
          <span className="micro">
            {allTakesCaptured ? "CAPTURE COMPLETE" : "RECORDING SEQUENCE"}
          </span>
          <h2>
            {currentStep
              ? <>{stepName(currentStep)}<em>.</em></>
              : <>All {sequence.length} takes captured<em>.</em></>}
          </h2>
          <p>
            {currentStep
              ? "Record, stop, and choose Keep & Next or Redo. The next countdown starts after you keep a take."
              : "Delete the last take to step backward, or save the full stack when you are happy with it."}
          </p>
        </div>

        <div className="variation-sequence-progress-copy">
          <strong>{takes.length}<span>/ {sequence.length}</span></strong>
          <small>TAKES CAPTURED</small>
        </div>
      </header>

      <div className="variation-sequence-track" aria-label={takes.length + " of " + sequence.length + " takes captured"}>
        {sequence.map((step, index) => {
          const state = index < takes.length ? "done" : index === takes.length ? "current" : "upcoming";
          return <div className={"variation-sequence-step " + state} key={slotKey(step.kind, step.position)}>
            <i />
            <span>{step.kind.toUpperCase()} {String(step.position).padStart(2, "0")}</span>
          </div>;
        })}
      </div>

      {currentStep && <>
        <div className="variation-current-tools">
          <div>
            <span className="micro">CURRENT TAKE</span>
            <strong>{stepName(currentStep)}</strong>
            <small>{takes.length + 1} of {sequence.length}</small>
          </div>
          <label className="variation-upload-current">
            UPLOAD CURRENT ↑
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) addUploadedTake(file);
              }}
            />
          </label>
        </div>

        <TeleprompterStudio
          sequenceStepKey={currentKey}
          autoStartSequence={autoStartStepKey === currentKey}
          initialScript={currentScript}
          contextLabel={currentStep.kind.toUpperCase() + " " + String(currentStep.position).padStart(2, "0") + " / SCRIPT"}
          captureMode
          sequenceCaptureMode
          scriptReadOnly={scriptImported}
          canDeletePreviousTake={takes.length > 0}
          onDeletePreviousTake={deleteLastTake}
          onScriptChange={scriptImported ? undefined : updateCurrentScript}
          onRecordingChange={markCurrentTake}
        />
      </>}

      {allTakesCaptured && <div className="variation-sequence-finish">
        <div>
          <span className="micro">STACK COMPLETE</span>
          <h3>{sequence.length} takes ready.</h3>
          <p>
            Save the stack to normalize each clip for combination building. If the last take is wrong, delete it and the recorder jumps back to that segment.
          </p>
        </div>
        <div className="variation-sequence-finish-actions">
          <button type="button" onClick={deleteLastTake} disabled={saving}>DELETE LAST TAKE</button>
          <button
            type="button"
            className="primary"
            onClick={() => void saveSegments()}
            disabled={saving || segmentsSaved}
          >
            {saving ? "SAVING " + uploadProgress + "%…" : segmentsSaved ? "SEGMENTS SAVED ✓" : "SAVE SEGMENTS →"}
          </button>
        </div>
      </div>}

      {saving && <div className="variation-upload-progress">
        <i style={{ width: uploadProgress + "%" }} />
      </div>}
    </section>}

    <section className="variation-generate">
      <div>
        <span className="micro">ASSEMBLE</span>
        <h2>
          {segmentsSaved
            ? targetCombinationCount + " combinations ready to build."
            : "Record the stack, then build the matrix."}
        </h2>
        <p>
          Each segment is normalized once, then Creative Circle joins the prepared Hook, Body, and CTA clips into every selected combination.
        </p>
      </div>
      <button
        type="button"
        disabled={!sessionId || !segmentsSaved || combinationCount < 1 || generating}
        onClick={() => void generate()}
      >
        {generating ? "BUILDING " + targetCombinationCount + "…" : "GENERATE " + targetCombinationCount + " VIDEOS"} <span>↗</span>
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
