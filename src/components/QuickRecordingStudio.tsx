"use client";

import { useEffect, useRef, useState } from "react";
import { TeleprompterStudio, type TeleprompterRecording } from "@/src/components/TeleprompterStudio";
import { parseQuickRecordingScript, type QuickRecordingClip, type QuickRecordingId } from "@/src/lib/quick-recording";
import styles from "./QuickRecordingStudio.module.css";
import type { RecordingFrameRate } from "@/src/lib/recording-quality";

type KeptTake = { id: QuickRecordingId; blob: Blob; mimeType: string; frameRate: RecordingFrameRate };

export function QuickRecordingStudio() {
  const [mode, setMode] = useState<"quick" | "single">("quick");
  const [masterScript, setMasterScript] = useState("");
  const [queue, setQueue] = useState<QuickRecordingClip[] | null>(null);
  const [takes, setTakes] = useState<KeptTake[]>([]);
  const [autoStartStep, setAutoStartStep] = useState<QuickRecordingId | null>(null);
  const [error, setError] = useState("");
  const [assembling, setAssembling] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [exportFrameRate, setExportFrameRate] = useState<RecordingFrameRate>(30);
  const [resultUrl, setResultUrl] = useState("");
  const resultUrlRef = useRef("");

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = "";
    setResultBlob(null);
    setResultUrl("");
    setExportFrameRate(30);
  }

  function begin() {
    const result = parseQuickRecordingScript(masterScript);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    clearResult();
    setError("");
    setTakes([]);
    setAutoStartStep(null);
    setQueue(result.clips);
  }

  function keepTake(recording: TeleprompterRecording | null) {
    if (!recording || !queue) return;
    const index = takes.length;
    const current = queue[index];
    if (!current) return;
    setTakes((previous) => previous.length === index
      ? [...previous, { id: current.id, blob: recording.blob, mimeType: recording.mimeType, frameRate: recording.frameRate }]
      : previous);
    setAutoStartStep(queue[index + 1]?.id ?? null);
    clearResult();
    setError("");
  }

  function removeLastTake() {
    if (assembling || !takes.length) return;
    setTakes((previous) => previous.slice(0, -1));
    setAutoStartStep(null);
    clearResult();
    setError("");
  }

  function reset() {
    if (takes.length && !window.confirm("Discard these recorded takes and return to the script?")) return;
    clearResult();
    setTakes([]);
    setQueue(null);
    setAutoStartStep(null);
    setError("");
  }

  function changeCurrentScript(value: string) {
    const current = queue?.[takes.length];
    if (!current) return;
    setQueue((previous) => previous?.map((step) => step.id === current.id ? { ...step, script: value } : step) ?? null);
  }

  async function assemble() {
    if (!queue || takes.length !== queue.length || assembling) return;
    clearResult();
    setError("");
    setAssembling(true);
    try {
      const form = new FormData();
      form.append("frameRate", takes.every((take) => take.frameRate === 60) ? "60" : "30");
      for (const take of takes) {
        const ext = take.mimeType.includes("mp4") ? "mp4" : take.mimeType.includes("quicktime") ? "mov" : "webm";
        form.append("clips", take.blob, take.id + "." + ext);
      }
      const response = await fetch("/api/creative-circle/recordings/assemble", { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "The video could not be created.");
      }
      const actualFps = response.headers.get("X-Creative-Circle-Frame-Rate");
      setExportFrameRate(actualFps === "60" ? 60 : 30);
      const blob = await response.blob();
      if (!blob.size) throw new Error("The server returned an empty video. Please try again.");
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResultBlob(blob);
      setResultUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the video. Try again.");
    } finally {
      setAssembling(false);
    }
  }

  async function share() {
    if (!resultBlob || !navigator.share) return;
    const file = new File([resultBlob], "creative-circle-recording.mp4", { type: "video/mp4" });
    try {
      await navigator.share({ files: [file], title: "Creative Circle recording" });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Sharing is not supported here. Use Download Video instead.");
    }
  }

  const current = queue?.[takes.length];
  const finished = Boolean(queue && takes.length === queue.length);

  return <div className={styles.root}>
    <div className={styles.mode} role="group" aria-label="Teleprompter mode">
      <button type="button" aria-pressed={mode === "quick"} disabled={Boolean(queue)} onClick={() => setMode("quick")}>Film a video · V6.1</button>
      <button type="button" aria-pressed={mode === "single"} disabled={Boolean(queue)} onClick={() => setMode("single")}>Classic teleprompter</button>
    </div>

    {mode === "single" ? <TeleprompterStudio /> : <>
      {!queue && <section className={styles.setup}>
        <label htmlFor="quick-recording-script">Your script (optional)</label>
        <p>Paste a plain script for one take, or use [[HOOK]], [[BODY 1]], [[BODY 2]], and [[CTA]] to record each part separately. Missing sections are fine. [[BEAT 1]] markers stay within their part; they do not create extra cuts.</p>
        <textarea
          id="quick-recording-script"
          value={masterScript}
          onChange={(event) => { setMasterScript(event.target.value); setError(""); }}
          placeholder={"[[HOOK]]\nYour opening...\n\n[[BODY 1]]\nFirst part...\n\n[[BODY 2]]\nSecond part...\n\n[[CTA]]\nYour ending..."}
          spellCheck
        />
        <button type="button" className={styles.primary} onClick={begin}>Start filming →</button>
      </section>}

      {queue && <section className={styles.header}>
        <div>
          <span className={styles.subheading}>V6.1 · RECORD AND DOWNLOAD</span>
          <h2>{current ? "Film " + current.label : "Your takes are ready"}</h2>
          <p>{current ? "Record, preview, and keep each take. Edit the current prompt without redoing previous clips." : "Combine your takes into one finished portrait video."}</p>
        </div>
        <div className={styles.counter}>{takes.length} / {queue.length} kept</div>
        <div className={styles.steps} aria-label="Recording progress">
          {queue.map((step, index) => <span
            key={step.id}
            className={styles.step}
            data-state={index < takes.length ? "done" : index === takes.length ? "current" : "upcoming"}
          >{step.label}</span>)}
        </div>
      </section>}

      {current && <TeleprompterStudio
        initialScript={current.script}
        contextLabel={current.label.toUpperCase() + " / SCRIPT"}
        sequenceCaptureMode
        captureMode
        sequenceStepKey={current.id}
        autoStartSequence={autoStartStep === current.id}
        onScriptChange={changeCurrentScript}
        onRecordingChange={keepTake}
        canDeletePreviousTake={takes.length > 0}
        onDeletePreviousTake={removeLastTake}
      />}

      {finished && <section className={styles.finish}>
        <h2>{resultUrl ? "Your video is ready" : "One video, no editor"}</h2>
        <p>{resultUrl ? "Download the finished MP4, or use Share on your phone to send it to your computer." : "Join all kept takes in order as one 1080 × 1920 MP4 (H.264 video and AAC audio). Your prompts and controls will not appear in the video."}</p>
        {resultUrl && <video className={styles.preview} src={resultUrl} controls playsInline aria-label="Finished video preview" />}
        <div className={styles.actions}>
          {resultUrl ? <>
            <span className={styles.hint}>1080 × 1920 · {exportFrameRate} FPS · H.264 + AAC · CapCut-ready MP4</span>
            <a className={styles.download} href={resultUrl} download="creative-circle-recording.mp4">Download video ↓</a>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && <button type="button" className={styles.secondary} onClick={() => void share()}>Share / AirDrop</button>}
          </> : <button type="button" className={styles.primary} disabled={assembling} onClick={() => void assemble()}>
            {assembling ? "Preparing video… Please keep this page open" : "Create finished video →"}
          </button>}
          <button type="button" className={styles.secondary} disabled={assembling} onClick={removeLastTake}>Redo last part</button>
          <button type="button" className={styles.secondary} disabled={assembling} onClick={reset}>Start over</button>
        </div>
        <p className={styles.hint}>Takes remain on this device until you leave or refresh. Export keeps 60 FPS only when every take supports it; otherwise it uses 30 FPS. Download before leaving.</p>
      </section>}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {assembling && <p className={styles.hint} role="status">Uploading and joining your clips. This can take a little while; do not close this page.</p>}
      {queue && !finished && <button type="button" className={styles.secondary} onClick={reset}>Back to script / start over</button>}
    </>}
  </div>;
}
